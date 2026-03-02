/**
 * 电学参数调节面板
 * ---------------------------------
 * 功能：
 * - 显示已选择的电学元件列表
 * - 提供参数调节控件（电压、电阻、开关状态）
 * - 参数变化实时生效（与力学场景不同，无需重置）
 * 
 * 2026-02-01 创建
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ELECTRIC_ELEMENTS, isAdjustable } from './electric/elementTypes.js';

export default function ElectricParametersPanel({ 
  elements,           // 已选择的电学元件列表
  onParametersChange, // 参数变化回调 (elementIndex, paramName, value)
  isSimulating        // 是否正在模拟
}) {
  const { t } = useTranslation();
  
  if (!elements || elements.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: '#9ca3af'
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 14, textAlign: 'center' }}>
          {t('uploadCircuitAndSelect')}<br />
          {t('adjustParamsHere')}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      padding: '16px'
    }}>
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 16,
        color: '#1f2937',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <span>⚡</span>
        {t('electricParamsTitle')}
        {isSimulating && (
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            background: '#dcfce7',
            color: '#166534',
            borderRadius: 4
          }}>
            {t('realTimeEffect')}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {elements.map((element, index) => (
          <ElementControl
            key={`${element.label}-${index}`}
            element={element}
            index={index}
            onParametersChange={onParametersChange}
          
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 单个元件的参数控件
 */
function ElementControl({ element, index, onParametersChange }) {
  const { t } = useTranslation();
  const config = ELECTRIC_ELEMENTS[element.element_type];
  if (!config) return null;

  const handleChange = (paramName, value) => {
    onParametersChange(index, paramName, value);
  };

  return (
    <div style={{
      padding: '12px',
      background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }}>
      {/* 元件名称 */}
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: '#374151',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}>
        <span style={{ fontSize: 16 }}>
          {getElementIcon(element.element_type)}
        </span>
        {element.label || element.name}
      </div>

      {/* 电压调节（电源） */}
      {element.element_type === 'battery' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 50 }}>{t('voltage')}</span>
          <input
            type="range"
            min={config.minVoltage || 1}
            max={config.maxVoltage || 12}
            step={0.5}
            value={element.parameters?.voltage_V ?? config.defaultVoltage}
            onChange={(e) => handleChange('voltage_V', parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: '#374151', minWidth: 40 }}>
            {element.parameters?.voltage_V ?? config.defaultVoltage}V
          </span>
        </div>
      )}

      {/* 电阻调节（电阻、灯泡、滑动变阻器） */}
      {(element.element_type === 'resistor' || 
        element.element_type === 'lamp' || 
        element.element_type === 'rheostat') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 50 }}>{t('resistance')}</span>
          <input
            type="range"
            min={config.minResistance || 0}
            max={config.maxResistance || 100}
            step={1}
            value={element.parameters?.resistance_ohm ?? config.defaultResistance}
            onChange={(e) => handleChange('resistance_ohm', parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: '#374151', minWidth: 40 }}>
            {element.parameters?.resistance_ohm ?? config.defaultResistance}Ω
          </span>
        </div>
      )}

      {/* 开关状态调节 */}
      {element.element_type === 'switch' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 50 }}>{t('status')}</span>
          <button
            onClick={() => handleChange('is_closed', !(element.parameters?.is_closed ?? false))}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: element.parameters?.is_closed ? '#16a34a' : '#d1d5db',
              background: element.parameters?.is_closed 
                ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' 
                : 'white',
              color: element.parameters?.is_closed ? '#166534' : '#6b7280',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            {element.parameters?.is_closed ? t('switchClosed') : t('switchOpen')}
          </button>
        </div>
      )}

      {/* 电流表和电压表只显示信息，不可调节 */}
      {(element.element_type === 'ammeter' || element.element_type === 'voltmeter') && (
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {element.element_type === 'ammeter' ? t('ammeterHint') : t('voltmeterHint')}
        </div>
      )}
    </div>
  );
}

/**
 * 获取元件图标
 */
function getElementIcon(elementType) {
  const icons = {
    battery: '🔋',
    resistor: '⚡',
    lamp: '💡',
    switch: '🔌',
    ammeter: '🔢',
    voltmeter: '📊',
    rheostat: '🎚️'
  };
  return icons[elementType] || '⚡';
}
