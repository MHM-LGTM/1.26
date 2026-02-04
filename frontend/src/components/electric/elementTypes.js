/**
 * 电学元件类型定义
 * ---------------------------------
 * 功能：
 * - 定义 AI 需要识别的电学元件类型
 * - 导线和节点由前端算法识别，不在此定义
 * - 每个元件定义默认参数和可调节项
 * 
 * 2026-02-01 创建
 */

// AI 识别的电学元件类型（不包含导线和节点）
export const ELECTRIC_ELEMENTS = {
  battery: { 
    name: '电源', 
    hasPolarity: true,
    defaultVoltage: 3,  // 默认3V
    minVoltage: 1,
    maxVoltage: 12,
    adjustable: ['voltage'],  // 可调节电压
    resistance: 0  // 内阻为0（理想电源）
  },
  resistor: { 
    name: '电阻', 
    heatsUp: true,  // 会发热
    defaultResistance: 10,  // 默认10Ω
    minResistance: 1,
    maxResistance: 1000,
    adjustable: ['resistance']  // 可调节电阻值
  },
  lamp: { 
    name: '小灯泡', 
    glows: true,  // 会发光
    defaultResistance: 5,  // 默认5Ω
    minResistance: 1,
    maxResistance: 100,
    adjustable: ['resistance']  // 可调节电阻值
  },
  switch: { 
    name: '开关',
    defaultClosed: false,  // 默认断开
    adjustable: ['closed'],  // 可调节闭合状态
    resistance: 0  // 闭合时电阻为0
    // 注：AI 只识别断开的开关
  },
  ammeter: { 
    name: '电流表', 
    resistance: 0.001  // 电阻极小，可忽略
  },
  voltmeter: { 
    name: '电压表', 
    resistance: Infinity  // 电阻极大，几乎不通电流
  },
  rheostat: { 
    name: '滑动变阻器',
    defaultResistance: 0,
    minResistance: 0,
    maxResistance: 50,
    adjustable: ['resistance']  // 直接调节电阻值
  }
};

/**
 * 获取元件的默认参数
 */
export function getDefaultParameters(elementType) {
  const config = ELECTRIC_ELEMENTS[elementType];
  if (!config) return {};
  
  const params = {};
  
  if (config.defaultVoltage !== undefined) {
    params.voltage_V = config.defaultVoltage;
  }
  if (config.defaultResistance !== undefined) {
    params.resistance_ohm = config.defaultResistance;
  }
  if (config.defaultClosed !== undefined) {
    params.is_closed = config.defaultClosed;
  }
  if (config.resistance !== undefined && config.defaultResistance === undefined) {
    params.resistance_ohm = config.resistance;
  }
  
  return params;
}

/**
 * 获取元件的电阻值（考虑开关状态）
 */
export function getElementResistance(element) {
  const config = ELECTRIC_ELEMENTS[element.element_type];
  if (!config) return 0;
  
  // 开关特殊处理
  if (element.element_type === 'switch') {
    // 闭合时有微小接触电阻（0.01Ω），避免被误判为短路
    return element.parameters?.is_closed ? 0.01 : Infinity;
  }
  
  // 电压表电阻极大
  if (element.element_type === 'voltmeter') {
    return Infinity;
  }
  
  // 其他元件使用参数中的电阻值
  return element.parameters?.resistance_ohm ?? config.defaultResistance ?? config.resistance ?? 0;
}

/**
 * 检查元件是否可调节某个参数
 */
export function isAdjustable(elementType, paramName) {
  const config = ELECTRIC_ELEMENTS[elementType];
  return config?.adjustable?.includes(paramName) ?? false;
}

/**
 * 获取元件的中文名称
 */
export function getElementName(elementType) {
  return ELECTRIC_ELEMENTS[elementType]?.name ?? elementType;
}
