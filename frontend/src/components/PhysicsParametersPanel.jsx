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
  
  // 绳索约束物体
  if (elementType === 'rope_constraint') {
    return {
      type: 'rope',
      params: {
        segments: obj.parameters?.segments ?? 25,
        stiffness: obj.parameters?.stiffness ?? 0.95,
        damping: obj.parameters?.damping ?? 0.98,
      }
    };
  }
  
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

const PhysicsParametersPanel = ({ objects = [], onParametersChange, onGlobalParametersChange, globalParameters, isSimulationRunning }) => {
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(0);
  const [localParams, setLocalParams] = useState({});
  const [parameterType, setParameterType] = useState('dynamic');
  
  // 全局参数：时间缩放
  const [timeScale, setTimeScale] = useState(1.0);
  
  // 【2026-02-05 修复】当父组件的 globalParameters 变化时，同步更新本地的 timeScale
  // 这样当加载新动画时，时间缩放的UI显示会正确同步
  useEffect(() => {
    if (globalParameters?.timeScale !== undefined && globalParameters.timeScale !== timeScale) {
      setTimeScale(globalParameters.timeScale);
      console.log('[PhysicsParametersPanel] 同步时间缩放:', globalParameters.timeScale);
    }
  }, [globalParameters]);

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
  
  // 处理全局参数变化（时间缩放）
  const handleTimeScaleChange = (value) => {
    setTimeScale(value);
    
    // 通知父组件全局参数已更改
    if (onGlobalParametersChange) {
      onGlobalParametersChange({ timeScale: value });
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
      'rope': '绳索',
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
        {/* 全局参数：时间缩放（慢镜头/快镜头）- 始终显示 */}
        {/* ====================================================================== */}
        <div className="param-section">
          <div className="section-title">⏱️ 时间缩放</div>
          
          <div className="param-item">
            <div className="param-header">
              <label className="param-label">
                时间速度 
                <span style={{ 
                  marginLeft: '8px', 
                  fontSize: '11px', 
                  color: timeScale < 0.8 ? '#f59e0b' : timeScale > 1.2 ? '#10b981' : '#6b7280',
                  fontWeight: 600
                }}>
                  {timeScale < 0.8 ? '🐢 慢镜头' : timeScale > 1.2 ? '⚡ 快镜头' : '⏸️ 正常'}
                </span>
              </label>
              <input
                type="number"
                className="param-value-input"
                value={timeScale}
                onChange={(e) => handleTimeScaleChange(parseFloat(e.target.value) || 1.0)}
                step="0.1"
                min="0.1"
                max="3"
              />
            </div>
            <input
              type="range"
              className="param-slider"
              min="0.1"
              max="3"
              step="0.1"
              value={timeScale}
              onChange={(e) => handleTimeScaleChange(parseFloat(e.target.value))}
            />
            <div className="param-hint">
              1.0 = 正常速度 | 0.5 = 慢镜头 | 2.0 = 快镜头（全局影响所有物体）
            </div>
          </div>
        </div>

        {/* ====================================================================== */}
        {/* 绳索参数 */}
        {/* ====================================================================== */}
        {parameterType === 'rope' && (
          <div className="param-section">
            <div className="section-title">🪢 绳索参数</div>
            
            {/* 绳子段数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">绳子段数</label>
                <input
                  type="number"
                  className="param-value-input"
                  value={localParams.segments ?? 25}
                  onChange={(e) => handleParamChange('segments', parseInt(e.target.value) || 25)}
                  step="1"
                  min="15"
                  max="50"
                />
              </div>
              <input
                type="range"
                className="param-slider"
                min="15"
                max="50"
                step="1"
                value={localParams.segments ?? 25}
                onChange={(e) => handleParamChange('segments', parseInt(e.target.value))}
              />
              <div className="param-hint">建议20-30段，段数越多越平滑但性能开销越大</div>
            </div>

            {/* 刚度系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">刚度系数</label>
                <input
                  type="number"
                  className="param-value-input"
                  value={localParams.stiffness ?? 0.95}
                  onChange={(e) => handleParamChange('stiffness', parseFloat(e.target.value) || 0.95)}
                  step="0.01"
                  min="0.85"
                  max="1"
                />
              </div>
              <input
                type="range"
                className="param-slider"
                min="0.85"
                max="1"
                step="0.01"
                value={localParams.stiffness ?? 0.95}
                onChange={(e) => handleParamChange('stiffness', parseFloat(e.target.value))}
              />
              <div className="param-hint">⚠️ 建议0.93-0.96，值越大绳子越硬</div>
            </div>

            {/* 阻尼系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">阻尼系数</label>
                <input
                  type="number"
                  className="param-value-input"
                  value={localParams.damping ?? 0.98}
                  onChange={(e) => handleParamChange('damping', parseFloat(e.target.value) || 0.98)}
                  step="0.01"
                  min="0.95"
                  max="1"
                />
              </div>
              <input
                type="range"
                className="param-slider"
                min="0.95"
                max="1"
                step="0.01"
                value={localParams.damping ?? 0.98}
                onChange={(e) => handleParamChange('damping', parseFloat(e.target.value))}
              />
              <div className="param-hint">建议0.97-0.98，值越小衰减越快</div>
            </div>
          </div>
        )}

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
