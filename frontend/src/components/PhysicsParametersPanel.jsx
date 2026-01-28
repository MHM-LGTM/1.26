/**
 * 物理参数调节面板
 * ---------------------------------
 * 功能：
 * - 显示当前场景中所有物体的物理参数
 * - 根据物体类型（刚体、弹簧、传送带等）显示不同的参数
 * - 允许用户调节各种物理参数
 * - 实时更新参数并触发重新模拟
 */

import React, { useState, useEffect } from 'react';
import './PhysicsParametersPanel.css';

// ============================================================================
// 根据物体类型确定需要显示的参数类型
// ============================================================================
const getParametersByType = (obj) => {
  const elementType = obj.element_type || 'rigid_body';
  const role = obj.role || 'dynamic';
  const isStatic = role === 'static';
  
  // 弹簧约束物体
  if (elementType === 'spring_constraint' || elementType === 'spring_launcher') {
    return {
      type: 'spring',
      params: {
        spring_stiffness: obj.parameters?.spring_stiffness ?? (elementType === 'spring_launcher' ? 200 : 100),
        spring_damping: obj.parameters?.spring_damping ?? 0.1,
      }
    };
  }
  
  // 传送带
  // ============================================================================
  // 【2026-01-28 修复】严格判断传送带类型，避免误识别
  // 只有以下情况才识别为传送带：
  // 1. element_type 明确标识为 'conveyor_belt'
  // 2. conveyor_speed 存在且不为 0（速度为 0 的传送带没有意义，应作为普通静态物体）
  // ============================================================================
  const conveyorSpeed = obj.parameters?.conveyor_speed;
  const isConveyorByType = elementType === 'conveyor_belt';
  const isConveyorBySpeed = conveyorSpeed !== undefined && conveyorSpeed !== null && conveyorSpeed !== 0;
  
  if (isConveyorByType || isConveyorBySpeed) {
    return {
      type: 'conveyor',
      params: {
        conveyor_speed: conveyorSpeed ?? 0,
        restitution: obj.parameters?.restitution ?? 0.5,
        friction_coefficient: obj.parameters?.friction_coefficient ?? 0.8,
      }
    };
  }
  
  // 摆球（需要约束刚度）
  if (elementType === 'pendulum_bob') {
    return {
      type: 'pendulum',
      params: {
        mass_kg: obj.parameters?.mass_kg ?? 1.0,
        constraint_stiffness: obj.parameters?.constraint_stiffness ?? 1.0,
        restitution: obj.parameters?.restitution ?? 0.5,
        friction_coefficient: obj.parameters?.friction_coefficient ?? 0.2,
        air_drag: obj.parameters?.air_drag ?? 0.0,
        initial_velocity_px_s: obj.parameters?.initial_velocity_px_s ?? 0,
        initial_velocity_y_px_s: obj.parameters?.initial_velocity_y_px_s ?? 0,
        initial_angular_velocity_rad_s: obj.parameters?.initial_angular_velocity_rad_s ?? 0,
      }
    };
  }
  
  // 普通刚体（动态或静态）
  if (isStatic) {
    return {
      type: 'static',
      params: {
        restitution: obj.parameters?.restitution ?? 0.5,
        friction_coefficient: obj.parameters?.friction_coefficient ?? 0.5,
      }
    };
  } else {
    return {
      type: 'dynamic',
      params: {
        mass_kg: obj.parameters?.mass_kg ?? 1.0,
        restitution: obj.parameters?.restitution ?? 0.5,
        friction_coefficient: obj.parameters?.friction_coefficient ?? 0.2,
        air_drag: obj.parameters?.air_drag ?? 0.0,
        initial_velocity_px_s: obj.parameters?.initial_velocity_px_s ?? 0,
        initial_velocity_y_px_s: obj.parameters?.initial_velocity_y_px_s ?? 0,
        initial_angular_velocity_rad_s: obj.parameters?.initial_angular_velocity_rad_s ?? 0,
      }
    };
  }
};

const PhysicsParametersPanel = ({ objects = [], onParametersChange, isSimulationRunning }) => {
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(0);
  const [localParams, setLocalParams] = useState({});
  const [parameterType, setParameterType] = useState('dynamic');

  // 当选中的物体改变时，更新本地参数
  useEffect(() => {
    if (objects.length > 0 && objects[selectedObjectIndex]) {
      const obj = objects[selectedObjectIndex];
      const { type, params } = getParametersByType(obj);
      setParameterType(type);
      setLocalParams(params);
    }
  }, [selectedObjectIndex, objects]);

  // 处理参数变化
  const handleParamChange = (paramName, value) => {
    const newParams = { ...localParams, [paramName]: value };
    setLocalParams(newParams);

    // 通知父组件参数已更改
    if (onParametersChange) {
      onParametersChange(selectedObjectIndex, newParams);
    }
  };

  if (objects.length === 0) {
    return (
      <div className="physics-params-panel">
        <div className="params-empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-text">暂无物体</div>
          <div className="empty-hint">完成物体分割后，可在此调节物理参数</div>
        </div>
      </div>
    );
  }

  const currentObject = objects[selectedObjectIndex];
  
  // 获取物体类型的显示标签
  const getTypeLabel = (type) => {
    const labels = {
      'dynamic': '动态',
      'static': '静态',
      'spring': '弹簧',
      'conveyor': '传送带',
      'pendulum': '摆球'
    };
    return labels[type] || '物体';
  };

  return (
    <div className="physics-params-panel">
      {/* 标题 */}
      <div className="params-header">
        <div className="params-title">💡 参数修改后，点击"重置"重新应用</div>
        {isSimulationRunning && (
          <div className="params-status-badge">
            <span className="status-dot"></span>
            运行中
          </div>
        )}
      </div>

      {/* 物体选择器 */}
      <div className="object-selector">
        <label className="selector-label">选择物体：</label>
        <div className="object-tabs">
          {objects.map((obj, idx) => {
            const { type } = getParametersByType(obj);
            return (
              <button
                key={idx}
                className={`object-tab ${selectedObjectIndex === idx ? 'active' : ''}`}
                onClick={() => setSelectedObjectIndex(idx)}
              >
                {obj.label || obj.name || `物体${idx + 1}`}
                <span className="type-badge">{getTypeLabel(type)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 参数调节区域 */}
      <div className="params-content">
        {/* ====================================================================== */}
        {/* 弹簧参数 */}
        {/* ====================================================================== */}
        {parameterType === 'spring' && (
          <div className="param-section">
            <div className="section-title">⚙️ 弹簧参数</div>
            
            {/* 劲度系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">劲度系数</label>
                <input
                  type="number"
                  className="param-value-input"
                  value={localParams.spring_stiffness ?? 100}
                  onChange={(e) => handleParamChange('spring_stiffness', parseFloat(e.target.value) || 0)}
                  step="10"
                  min="10"
                />
              </div>
              <input
                type="range"
                className="param-slider"
                min="10"
                max="500"
                step="10"
                value={localParams.spring_stiffness ?? 100}
                onChange={(e) => handleParamChange('spring_stiffness', parseFloat(e.target.value))}
              />
              <div className="param-hint">弹簧的硬度，值越大弹簧越硬</div>
            </div>

            {/* 阻尼系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">阻尼系数</label>
                <input
                  type="number"
                  className="param-value-input"
                  value={localParams.spring_damping ?? 0.1}
                  onChange={(e) => handleParamChange('spring_damping', parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  max="1"
                />
              </div>
              <input
                type="range"
                className="param-slider"
                min="0"
                max="1"
                step="0.01"
                value={localParams.spring_damping ?? 0.1}
                onChange={(e) => handleParamChange('spring_damping', parseFloat(e.target.value))}
              />
              <div className="param-hint">弹簧振动的衰减速度，值越大衰减越快</div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* 传送带参数 */}
        {/* ====================================================================== */}
        {parameterType === 'conveyor' && (
          <>
            <div className="param-section">
              <div className="section-title">🔄 传送带参数</div>
              
              {/* 传送速度 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">传送速度 (px/s)</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.conveyor_speed ?? 0}
                    onChange={(e) => handleParamChange('conveyor_speed', parseFloat(e.target.value) || 0)}
                    step="10"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="-300"
                  max="300"
                  step="10"
                  value={localParams.conveyor_speed ?? 0}
                  onChange={(e) => handleParamChange('conveyor_speed', parseFloat(e.target.value))}
                />
                <div className="param-hint">传送带的移动速度，正值向右，负值向左</div>
              </div>

              {/* 弹性系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">弹性系数</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.restitution ?? 0.5}
                    onChange={(e) => handleParamChange('restitution', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    max="1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={localParams.restitution ?? 0.5}
                  onChange={(e) => handleParamChange('restitution', parseFloat(e.target.value))}
                />
                <div className="param-hint">0 = 非弹性碰撞，1 = 弹性碰撞</div>
              </div>

              {/* 摩擦系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">摩擦系数</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.friction_coefficient ?? 0.8}
                    onChange={(e) => handleParamChange('friction_coefficient', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    max="1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={localParams.friction_coefficient ?? 0.8}
                  onChange={(e) => handleParamChange('friction_coefficient', parseFloat(e.target.value))}
                />
                <div className="param-hint">传送带表面的摩擦力，影响传送效果</div>
              </div>
            </div>
          </>
        )}

        {/* ====================================================================== */}
        {/* 摆球参数 */}
        {/* ====================================================================== */}
        {parameterType === 'pendulum' && (
          <>
            <div className="param-section">
              <div className="section-title">🔗 约束参数</div>
              
              {/* 约束刚度 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">约束刚度</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.constraint_stiffness ?? 1.0}
                    onChange={(e) => handleParamChange('constraint_stiffness', parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0.1"
                    max="1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0.1"
                  max="1"
                  step="0.01"
                  value={localParams.constraint_stiffness ?? 1.0}
                  onChange={(e) => handleParamChange('constraint_stiffness', parseFloat(e.target.value))}
                />
                <div className="param-hint">约束的硬度，1.0为刚性杆，小于1为柔性绳</div>
              </div>
            </div>
            
            <div className="param-section">
              <div className="section-title">📊 基础参数</div>
              
              {/* 质量 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">质量 (kg)</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.mass_kg ?? 1.0}
                    onChange={(e) => handleParamChange('mass_kg', parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={localParams.mass_kg ?? 1.0}
                  onChange={(e) => handleParamChange('mass_kg', parseFloat(e.target.value))}
                />
                <div className="param-hint">摆球的质量</div>
              </div>

              {/* 弹性系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">弹性系数</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.restitution ?? 0.5}
                    onChange={(e) => handleParamChange('restitution', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    max="1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={localParams.restitution ?? 0.5}
                  onChange={(e) => handleParamChange('restitution', parseFloat(e.target.value))}
                />
                <div className="param-hint">0 = 非弹性碰撞，1 = 弹性碰撞</div>
              </div>

              {/* 摩擦系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">摩擦系数</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.friction_coefficient ?? 0.2}
                    onChange={(e) => handleParamChange('friction_coefficient', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    max="1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={localParams.friction_coefficient ?? 0.2}
                  onChange={(e) => handleParamChange('friction_coefficient', parseFloat(e.target.value))}
                />
                <div className="param-hint">摆球与其他物体的摩擦</div>
              </div>

              {/* 空气阻力 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">空气阻力</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.air_drag ?? 0.0}
                    onChange={(e) => handleParamChange('air_drag', parseFloat(e.target.value) || 0)}
                    step="0.001"
                    min="0"
                    max="0.1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={localParams.air_drag ?? 0.0}
                  onChange={(e) => handleParamChange('air_drag', parseFloat(e.target.value))}
                />
                <div className="param-hint">影响摆动的衰减</div>
              </div>
            </div>
          </>
        )}

        {/* ====================================================================== */}
        {/* 静态刚体参数 */}
        {/* ====================================================================== */}
        {parameterType === 'static' && (
          <div className="param-section">
            <div className="section-title">📊 基础参数</div>
            
            {/* 弹性系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">弹性系数</label>
                <input
                  type="number"
                  className="param-value-input"
                  value={localParams.restitution ?? 0.5}
                  onChange={(e) => handleParamChange('restitution', parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  max="1"
                />
              </div>
              <input
                type="range"
                className="param-slider"
                min="0"
                max="1"
                step="0.01"
                value={localParams.restitution ?? 0.5}
                onChange={(e) => handleParamChange('restitution', parseFloat(e.target.value))}
              />
              <div className="param-hint">0 = 非弹性碰撞，1 = 弹性碰撞</div>
            </div>

            {/* 摩擦系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">摩擦系数</label>
                <input
                  type="number"
                  className="param-value-input"
                  value={localParams.friction_coefficient ?? 0.5}
                  onChange={(e) => handleParamChange('friction_coefficient', parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  max="1"
                />
              </div>
              <input
                type="range"
                className="param-slider"
                min="0"
                max="1"
                step="0.01"
                value={localParams.friction_coefficient ?? 0.5}
                onChange={(e) => handleParamChange('friction_coefficient', parseFloat(e.target.value))}
              />
              <div className="param-hint">表面的滑动阻力</div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* 动态刚体参数 */}
        {/* ====================================================================== */}
        {parameterType === 'dynamic' && (
          <>
            <div className="param-section">
              <div className="section-title">📊 基础参数</div>
              
              {/* 质量 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">质量 (kg)</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.mass_kg ?? 1.0}
                    onChange={(e) => handleParamChange('mass_kg', parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={localParams.mass_kg ?? 1.0}
                  onChange={(e) => handleParamChange('mass_kg', parseFloat(e.target.value))}
                />
                <div className="param-hint">物体的质量，影响惯性</div>
              </div>

              {/* 弹性系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">弹性系数</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.restitution ?? 0.5}
                    onChange={(e) => handleParamChange('restitution', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    max="1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={localParams.restitution ?? 0.5}
                  onChange={(e) => handleParamChange('restitution', parseFloat(e.target.value))}
                />
                <div className="param-hint">0 = 非弹性碰撞，1 = 弹性碰撞</div>
              </div>

              {/* 摩擦系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">摩擦系数</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.friction_coefficient ?? 0.2}
                    onChange={(e) => handleParamChange('friction_coefficient', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    max="1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={localParams.friction_coefficient ?? 0.2}
                  onChange={(e) => handleParamChange('friction_coefficient', parseFloat(e.target.value))}
                />
                <div className="param-hint">物体间的滑动阻力</div>
              </div>

              {/* 空气阻力 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">空气阻力</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.air_drag ?? 0.0}
                    onChange={(e) => handleParamChange('air_drag', parseFloat(e.target.value) || 0)}
                    step="0.001"
                    min="0"
                    max="0.1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={localParams.air_drag ?? 0.0}
                  onChange={(e) => handleParamChange('air_drag', parseFloat(e.target.value))}
                />
                <div className="param-hint">空中的减速效果</div>
              </div>
            </div>

            {/* 初始运动参数 */}
            <div className="param-section">
              <div className="section-title">🚀 初始运动</div>
              
              {/* 初始水平速度 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">水平速度 (px/s)</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.initial_velocity_px_s ?? 0}
                    onChange={(e) => handleParamChange('initial_velocity_px_s', parseFloat(e.target.value) || 0)}
                    step="10"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="-500"
                  max="500"
                  step="10"
                  value={localParams.initial_velocity_px_s ?? 0}
                  onChange={(e) => handleParamChange('initial_velocity_px_s', parseFloat(e.target.value))}
                />
                <div className="param-hint">正值→右，负值→左</div>
              </div>

              {/* 初始垂直速度 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">垂直速度 (px/s)</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.initial_velocity_y_px_s ?? 0}
                    onChange={(e) => handleParamChange('initial_velocity_y_px_s', parseFloat(e.target.value) || 0)}
                    step="10"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="-500"
                  max="500"
                  step="10"
                  value={localParams.initial_velocity_y_px_s ?? 0}
                  onChange={(e) => handleParamChange('initial_velocity_y_px_s', parseFloat(e.target.value))}
                />
                <div className="param-hint">正值→下，负值→上</div>
              </div>

              {/* 初始角速度 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">旋转速度 (rad/s)</label>
                  <input
                    type="number"
                    className="param-value-input"
                    value={localParams.initial_angular_velocity_rad_s ?? 0}
                    onChange={(e) => handleParamChange('initial_angular_velocity_rad_s', parseFloat(e.target.value) || 0)}
                    step="0.1"
                  />
                </div>
                <input
                  type="range"
                  className="param-slider"
                  min="-10"
                  max="10"
                  step="0.1"
                  value={localParams.initial_angular_velocity_rad_s ?? 0}
                  onChange={(e) => handleParamChange('initial_angular_velocity_rad_s', parseFloat(e.target.value))}
                />
                <div className="param-hint">正值顺时针旋转</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PhysicsParametersPanel;
