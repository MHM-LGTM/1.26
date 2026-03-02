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
import { useTranslation } from 'react-i18next';
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
        initial_velocity_px_s: obj.parameters?.initial_velocity_px_s ?? 0,
        initial_velocity_y_px_s: obj.parameters?.initial_velocity_y_px_s ?? 0,
      }
    };
  }
  
  // 普通刚体（动态或静态）
  if (isStatic) {
    return {
      type: 'static',
      params: {
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
        initial_velocity_px_s: obj.parameters?.initial_velocity_px_s ?? 0,
        initial_velocity_y_px_s: obj.parameters?.initial_velocity_y_px_s ?? 0,
        // 运动轨迹参数
        show_trail: obj.parameters?.show_trail ?? false,
        trail_color: obj.parameters?.trail_color ?? '#ffd700',
        // 自定义路径参数
        custom_path_enabled: obj.parameters?.custom_path_enabled ?? false,
        path_speed: obj.parameters?.path_speed ?? 100,
        custom_path_points: obj.parameters?.custom_path_points ?? [],
      }
    };
  }
};

const PhysicsParametersPanel = ({ objects = [], onParametersChange, onGlobalParametersChange, globalParameters, isSimulationRunning }) => {
  const { t } = useTranslation();
  const [selectedObjectIndex, setSelectedObjectIndex] = useState(0);
  const [localParams, setLocalParams] = useState({});
  const [parameterType, setParameterType] = useState('dynamic');
  
  // 全局参数：时间缩放
  const [timeScale, setTimeScale] = useState(1.0);
  
  // 路径可视化显示开关（仅影响运行时显示，不是物理参数）
  const [showPathVisuals, setShowPathVisuals] = useState(true);

  // 将当前值持续暴露给window，供PhysicsInputBox在创建引擎时读取初始值
  useEffect(() => {
    window.currentPathVisualsVisible = showPathVisuals;
  }, [showPathVisuals]);

  // 模拟启动时，将当前的路径可视化状态同步到引擎
  // 修复：无论路径开关处于何种状态，点击开始模拟后引擎默认showPathVisuals=true
  // 需要在模拟启动后立刻将UI状态同步过去
  useEffect(() => {
    if (isSimulationRunning && window.setPathVisualsVisible) {
      window.setPathVisualsVisible(showPathVisuals);
    }
  }, [isSimulationRunning]);
  
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
          <div className="empty-text">{t('noObjects')}</div>
          <div className="empty-hint">{t('objectsHint')}</div>
        </div>
      </div>
    );
  }

  const currentObject = objects[selectedObjectIndex];
  
  // 获取物体类型的显示标签
  const getTypeLabel = (type) => {
    const labels = {
      'dynamic': t('typeDynamic'),
      'static': t('typeStatic'),
      'rope': t('typeRope'),
      'spring': t('typeSpring'),
      'conveyor': t('typeConveyor'),
      'pendulum': t('typePendulum')
    };
    return labels[type] || t('typeObject');
  };

  return (
    <div className="physics-params-panel">
      {/* 标题 */}
      <div className="params-header">
        <div className="params-title">{t('paramResetHint')}</div>
        {isSimulationRunning && (
          <div className="params-status-badge">
            <span className="status-dot"></span>
            {t('running')}
          </div>
        )}
      </div>

      {/* 物体选择器 */}
      <div className="object-selector">
        <label className="selector-label">{t('selectObject')}</label>
        <div className="object-tabs">
          {objects.map((obj, idx) => {
            const { type } = getParametersByType(obj);
            return (
              <button
                key={idx}
                className={`object-tab ${selectedObjectIndex === idx ? 'active' : ''}`}
                onClick={() => setSelectedObjectIndex(idx)}
              >
                {obj.label || obj.name || `${t('typeObject')}${idx + 1}`}
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
          <div className="section-title">{t('timeScaleTitle')}</div>
          
          <div className="param-item">
            <div className="param-header">
              <label className="param-label">
                {t('timeSpeed')} 
                <span style={{ 
                  marginLeft: '8px', 
                  fontSize: '11px', 
                  color: timeScale < 0.8 ? '#f59e0b' : timeScale > 1.2 ? '#10b981' : '#6b7280',
                  fontWeight: 600
                }}>
                  {timeScale < 0.8 ? t('slowMotion') : timeScale > 1.2 ? t('fastMotion') : t('normalSpeed')}
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
              {t('timeScaleHint')}
            </div>
          </div>
        </div>

        {/* ====================================================================== */}
        {/* 绳索参数 */}
        {/* ====================================================================== */}
        {parameterType === 'rope' && (
          <div className="param-section">
            <div className="section-title">{t('ropeParamsTitle')}</div>
            
            {/* 绳子段数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">{t('ropeSegments')}</label>
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
              <div className="param-hint">{t('ropeSegmentsHint')}</div>
            </div>

            {/* 刚度系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">{t('stiffnessCoefficient')}</label>
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
              <div className="param-hint">{t('stiffnessHint')}</div>
            </div>

            {/* 阻尼系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">{t('dampingCoefficient')}</label>
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
              <div className="param-hint">{t('dampingHint')}</div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* 弹簧参数 */}
        {/* ====================================================================== */}
        {parameterType === 'spring' && (
          <div className="param-section">
            <div className="section-title">{t('springParamsTitle')}</div>
            
            {/* 劲度系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">{t('springStiffness')}</label>
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
              <div className="param-hint">{t('springStiffnessHint')}</div>
            </div>

            {/* 阻尼系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">{t('dampingCoefficient')}</label>
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
              <div className="param-hint">{t('springDampingHint')}</div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* 传送带参数 */}
        {/* ====================================================================== */}
        {parameterType === 'conveyor' && (
          <>
            <div className="param-section">
              <div className="section-title">{t('conveyorParamsTitle')}</div>
              
              {/* 传送速度 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('conveyorSpeed')}</label>
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
                <div className="param-hint">{t('conveyorSpeedHint')}</div>
              </div>

              {/* 弹性系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('elasticity')}</label>
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
                <div className="param-hint">{t('elasticityHint')}</div>
              </div>

              {/* 摩擦系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('friction')}</label>
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
                <div className="param-hint">{t('conveyorFrictionHint')}</div>
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
              <div className="section-title">{t('constraintParamsTitle')}</div>
              
              {/* 约束刚度 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('constraintStiffness')}</label>
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
                <div className="param-hint">{t('constraintStiffnessHint')}</div>
              </div>
            </div>
            
            <div className="param-section">
              <div className="section-title">{t('basicParamsTitle')}</div>
              
              {/* 质量 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('mass')}</label>
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
                <div className="param-hint">{t('pendulumMassHint')}</div>
              </div>

              {/* 弹性系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('elasticity')}</label>
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
                <div className="param-hint">{t('elasticityHint')}</div>
              </div>

              {/* 摩擦系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('friction')}</label>
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
                <div className="param-hint">{t('pendulumFrictionHint')}</div>
              </div>
            </div>
          </>
        )}

        {/* ====================================================================== */}
        {/* 静态刚体参数 */}
        {/* ====================================================================== */}
        {parameterType === 'static' && (
          <div className="param-section">
            <div className="section-title">{t('basicParamsTitle')}</div>
            
            {/* 摩擦系数 */}
            <div className="param-item">
              <div className="param-header">
                <label className="param-label">{t('friction')}</label>
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
              <div className="param-hint">{t('surfaceFrictionHint')}</div>
            </div>
          </div>
        )}

        {/* ====================================================================== */}
        {/* 动态刚体参数 */}
        {/* ====================================================================== */}
        {parameterType === 'dynamic' && (
          <>
            {/* 自定义路径参数 */}
            <div className="param-section">
              <div className="section-title">{t('customPathTitle')}</div>
              
              {/* 启用自定义路径开关 */}
              <div className="param-item">
                <div className="param-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="param-label">{t('customPathMode')}</label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={localParams.custom_path_enabled ?? false}
                      onChange={(e) => handleParamChange('custom_path_enabled', e.target.checked)}
                      style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: localParams.custom_path_enabled ? '#10b981' : '#6b7280' }}>
                      {localParams.custom_path_enabled ? t('enabled') : t('notEnabled')}
                    </span>
                  </label>
                </div>
                <div className="param-hint">{t('customPathHint')}</div>
              </div>

              {/* 路径速度 - 仅在启用路径时显示 */}
              {localParams.custom_path_enabled && (
                <>
                  <div className="param-item">
                    <div className="param-header">
                      <label className="param-label">{t('pathSpeed')}</label>
                      <input
                        type="number"
                        className="param-value-input"
                        value={localParams.path_speed ?? 100}
                        onChange={(e) => handleParamChange('path_speed', parseFloat(e.target.value) || 100)}
                        step="10"
                        min="10"
                        max="500"
                      />
                    </div>
                    <input
                      type="range"
                      className="param-slider"
                      min="10"
                      max="500"
                      step="10"
                      value={localParams.path_speed ?? 100}
                      onChange={(e) => handleParamChange('path_speed', parseFloat(e.target.value))}
                    />
                    <div className="param-hint">{t('pathSpeedHint')}</div>
                  </div>
                  
                  {/* 路径编辑按钮 */}
                  <div className="param-item">
                    <div className="param-header" style={{ justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          // 触发父组件的路径编辑回调
                          if (window.enablePathEdit) {
                            window.enablePathEdit(selectedObjectIndex);
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#f97316',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#ea580c';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f97316';
                        }}
                      >
                        {t('clickCanvasSetPath')}
                      </button>
                    </div>
                    <div className="param-hint">{t('clickToSetPathPoints')}</div>
                  </div>

                  {/* 路径可视化显示开关 */}
                  <div className="param-item">
                    <div className="param-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="param-label">{t('showPathMarker')}</label>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showPathVisuals}
                          onChange={(e) => {
                            const visible = e.target.checked;
                            setShowPathVisuals(visible);
                            if (window.setPathVisualsVisible) {
                              window.setPathVisualsVisible(visible);
                            }
                          }}
                          style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', color: showPathVisuals ? '#10b981' : '#6b7280' }}>
                          {showPathVisuals ? t('show') : t('hidden')}
                        </span>
                      </label>
                    </div>
                    <div className="param-hint">{t('pathVisualHint')}</div>
                  </div>
                </>
              )}
            </div>
            
            <div className="param-section">
              <div className="section-title">{t('basicParamsTitle')}</div>
              
              {/* 质量 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('mass')}</label>
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
                <div className="param-hint">{t('massHint')}</div>
              </div>

              {/* 弹性系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('elasticity')}</label>
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
                <div className="param-hint">{t('elasticityHint')}</div>
              </div>

              {/* 摩擦系数 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('friction')}</label>
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
                <div className="param-hint">{t('objectFrictionHint')}</div>
              </div>
            </div>

            {/* 初始运动参数 */}
            <div className="param-section">
              <div className="section-title">{t('initialMotionTitle')}</div>
              
              {/* 初始水平速度 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('horizontalVelocity')}</label>
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
                <div className="param-hint">{t('horizontalVelocityHint')}</div>
              </div>

              {/* 初始垂直速度 */}
              <div className="param-item">
                <div className="param-header">
                  <label className="param-label">{t('verticalVelocity')}</label>
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
                <div className="param-hint">{t('verticalVelocityHint')}</div>
              </div>
            </div>

            {/* 运动轨迹参数 */}
            <div className="param-section">
              <div className="section-title">{t('motionTrailTitle')}</div>
              
              {/* 显示轨迹开关 */}
              <div className="param-item">
                <div className="param-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="param-label">{t('showMotionTrail')}</label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={localParams.show_trail ?? false}
                      onChange={(e) => handleParamChange('show_trail', e.target.checked)}
                      style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: localParams.show_trail ? '#10b981' : '#6b7280' }}>
                      {localParams.show_trail ? t('enabled') : t('notEnabled')}
                    </span>
                  </label>
                </div>
                <div className="param-hint">{t('trailHint')}</div>
              </div>

              {/* 轨迹颜色 - 仅在启用轨迹时显示 */}
              {localParams.show_trail && (
                <div className="param-item">
                  <div className="param-header">
                    <label className="param-label">{t('trailColor')}</label>
                    <select
                      className="param-value-input"
                      value={localParams.trail_color ?? '#ffd700'}
                      onChange={(e) => handleParamChange('trail_color', e.target.value)}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="#ffd700">{t('colorYellow')}</option>
                      <option value="#000000">{t('colorBlack')}</option>
                      <option value="#00bfff">{t('colorBlue')}</option>
                      <option value="#00ff00">{t('colorGreen')}</option>
                    </select>
                  </div>
                  <div className="param-hint">{t('trailColorHint')}</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PhysicsParametersPanel;
