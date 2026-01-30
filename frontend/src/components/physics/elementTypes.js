/**
 * 特殊元素类型配置
 * ====================================
 * 功能：定义需要特殊交互的元素类型及其配置
 * 
 * 扩展性设计：
 * - 新增特殊元素时，只需在 SPECIAL_ELEMENT_TYPES 中添加配置
 * - 每种类型定义自己的交互模式和处理函数
 * 
 * 2025-11-25 更新：添加弹簧系统支持
 * - spring_constraint: 约束型弹簧，需要选择两个连接点
 * - spring_launcher: 弹射型弹簧，需要选择固定点和弹射端
 */

export const SPECIAL_ELEMENT_TYPES = {
  // 摆球：需要选择支点
  pendulum_bob: {
    needsPivot: true,
    needsSecondPivot: false,  // 只需要一个支点
    interactionMode: 'select_pivot',
    defaultPrompt: '请点击选择该摆球的支点（悬挂点）',
    defaultSecondPrompt: null,
  },
  // 约束型弹簧：需要选择两个连接点
  spring_constraint: {
    needsPivot: true,
    needsSecondPivot: true,  // 需要两个端点
    interactionMode: 'select_spring_endpoints',
    defaultPrompt: '请点击选择弹簧的第一个连接点',
    defaultSecondPrompt: '请点击选择弹簧的第二个连接点',
  },
  // 弹射型弹簧：需要选择固定点和弹射端
  spring_launcher: {
    needsPivot: true,
    needsSecondPivot: true,  // 需要两个端点
    interactionMode: 'select_spring_endpoints',
    defaultPrompt: '请点击选择弹簧的固定支点（墙壁或固定物体）',
    defaultSecondPrompt: '请点击选择弹簧的弹射端连接点',
  },
  // 可在此添加更多特殊元素类型...
};

/**
 * 检查元素是否需要特殊交互（第一个支点选择）
 * @param {Object} elem - 元素对象
 * @returns {boolean} - 是否需要支点选择
 */
export const elementNeedsSpecialInteraction = (elem) => {
  if (!elem) return false;
  // 优先使用后端返回的 constraints.needs_pivot
  if (elem.constraints?.needs_pivot === true) return true;
  // 其次根据 element_type 判断
  const typeConfig = SPECIAL_ELEMENT_TYPES[elem.element_type];
  return typeConfig?.needsPivot === true;
};

/**
 * 检查元素是否需要第二个支点选择（弹簧系统专用）
 * @param {Object} elem - 元素对象
 * @returns {boolean} - 是否需要第二个支点
 */
export const elementNeedsSecondPivot = (elem) => {
  if (!elem) return false;
  // 优先使用后端返回的 constraints.needs_second_pivot
  if (elem.constraints?.needs_second_pivot === true) return true;
  // 其次根据 element_type 判断
  const typeConfig = SPECIAL_ELEMENT_TYPES[elem.element_type];
  return typeConfig?.needsSecondPivot === true;
};

/**
 * 获取元素的第一个端点交互提示文案
 * @param {Object} elem - 元素对象
 * @returns {string} - 提示文案
 */
export const getElementPivotPrompt = (elem) => {
  if (!elem) return '请选择支点';
  // 优先使用后端返回的提示文案
  if (elem.constraints?.pivot_prompt) return elem.constraints.pivot_prompt;
  // 其次使用默认提示
  const typeConfig = SPECIAL_ELEMENT_TYPES[elem.element_type];
  return typeConfig?.defaultPrompt || '请选择支点';
};

/**
 * 获取元素的第二个端点交互提示文案（弹簧系统专用）
 * @param {Object} elem - 元素对象
 * @returns {string} - 提示文案
 */
export const getElementSecondPivotPrompt = (elem) => {
  if (!elem) return '请选择第二个连接点';
  // 优先使用后端返回的提示文案
  if (elem.constraints?.second_pivot_prompt) return elem.constraints.second_pivot_prompt;
  // 其次使用默认提示
  const typeConfig = SPECIAL_ELEMENT_TYPES[elem.element_type];
  return typeConfig?.defaultSecondPrompt || '请选择第二个连接点';
};
