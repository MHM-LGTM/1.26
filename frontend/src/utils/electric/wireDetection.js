/**
 * 导线识别算法（基于连通域 Blob 分析）
 * ---------------------------------
 * 功能：
 * - 从电路图中识别导线路径
 * - 检测导线与电学元件的连接关系
 * - 使用图像处理技术：掩膜剔除、二值化、连通域标记、碰撞检测
 * 
 * 算法流程：
 * 1. 创建元件掩膜，将已识别元件区域涂白
 * 2. 灰度化 -> 高斯模糊（去噪）-> 自适应二值化
 * 3. 连通域标记（CCL），找出所有黑色 Blob
 * 4. 剔除小面积噪点
 * 5. 碰撞检测：检测 Blob 的轮廓与元件的轮廓是否相交或被直接接近
 * 6. 构建连接图：如果 Blob_A 同时接触了 Element_1 和 Element_2，则它们导通
 * 
 * 优点：完全不受导线粗细不均、骨架分叉的影响。只要导线视觉上是连着的，它们就是一个 Blob。
 * 
 * 2026-02-02 更新：使用 Blob 方法替换骨架化方法
 */

/**
 * 主函数：检测导线并建立连接关系
 * @param {HTMLImageElement} image - 原始电路图图片
 * @param {Array} elements - 已分割的电学元件列表，每个包含 contour 属性
 * @param {HTMLCanvasElement} workCanvas - 工作画布（可选，用于调试）
 * @returns {Object} { blobs, connections, connectionGraph, debugData }
 */
export async function detectWires(image, elements, workCanvas = null) {
  console.log('[WireDetection] 开始导线识别（Blob 方法），元件数量:', elements.length);
  
  // 创建工作画布
  const canvas = workCanvas || document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  console.log('[WireDetection] 图像尺寸:', canvas.width, 'x', canvas.height);
  
  // 1. 绘制原图
  ctx.drawImage(image, 0, 0);
  const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // 2. 创建元件掩膜并剔除
  console.log('[WireDetection] 步骤1: 创建元件掩膜...');
  const maskedImageData = createComponentMask(originalImageData, elements, canvas.width, canvas.height);
  
  // 3. 转换为灰度图
  console.log('[WireDetection] 步骤2: 转换为灰度图...');
  const grayData = toGrayscale(maskedImageData);
  
  // 4. 高斯模糊（去噪）
  console.log('[WireDetection] 步骤3: 高斯模糊去噪...');
  const blurredData = gaussianBlur(grayData, canvas.width, canvas.height);
  
  // 5. 自适应二值化
  console.log('[WireDetection] 步骤4: 二值化...');
  const binaryData = adaptiveBinarize(blurredData, canvas.width, canvas.height);
  
  // 统计导线像素
  let wirePixelCount = 0;
  for (let i = 0; i < binaryData.length; i++) {
    if (binaryData[i] === 1) wirePixelCount++;
  }
  console.log('[WireDetection] 导线像素数:', wirePixelCount, '/', binaryData.length, 
    '(' + (wirePixelCount / binaryData.length * 100).toFixed(2) + '%)');
  
  // 6. 形态学处理：去噪 + 填补间隙
  console.log('[WireDetection] 步骤5: 形态学处理（去噪 + 填补间隙）...');
  const cleanedData = morphologicalClean(binaryData, canvas.width, canvas.height);
  
  // 7. 跳过额外膨胀（避免过度连接）
  console.log('[WireDetection] 步骤6: 跳过膨胀处理（使用清理后的数据）...');
  const dilatedData = cleanedData; // 不进行膨胀，直接使用清理后的数据
  
  // 统计导线像素
  wirePixelCount = 0;
  for (let i = 0; i < dilatedData.length; i++) {
    if (dilatedData[i] === 1) wirePixelCount++;
  }
  console.log('[WireDetection] 最终导线像素数:', wirePixelCount, '/', dilatedData.length,
    '(' + (wirePixelCount / dilatedData.length * 100).toFixed(2) + '%)');
  
  // 8. 连通域标记（CCL）
  console.log('[WireDetection] 步骤7: 连通域标记（CCL）...');
  const { labelData, blobCount } = connectedComponentLabeling(dilatedData, canvas.width, canvas.height);
  console.log('[WireDetection] 发现 Blob 数量:', blobCount);
  
  // 9. 提取 Blob 信息并过滤小噪点
  console.log('[WireDetection] 步骤8: 提取 Blob 信息，过滤小噪点...');
  const blobs = extractAndFilterBlobs(labelData, canvas.width, canvas.height, blobCount);
  console.log('[WireDetection] 过滤后 Blob 数量:', blobs.length);
  
  // 10. Blob 与元件轮廓碰撞检测
  console.log('[WireDetection] 步骤9: Blob 与元件碰撞检测...');
  const blobConnections = detectBlobElementConnections(blobs, elements);
  console.log('[WireDetection] Blob 连接信息:', blobConnections.length);
  
  // 11. 构建连接图
  console.log('[WireDetection] 步骤10: 构建连接图...');
  const connectionGraph = buildConnectionGraphFromBlobs(blobConnections, elements);
  console.log('[WireDetection] 图节点数:', connectionGraph.nodes.length, '边数:', connectionGraph.edges.length);
  
  return {
    blobs,                // Blob 列表
    blobConnections,      // Blob-元件连接关系
    connectionGraph,      // 连接图（用于电路分析）
    debugData: {
      masked: maskedImageData,
      binary: binaryData,
      cleaned: cleanedData,
      dilated: dilatedData,
      labels: labelData
    }
  };
}

/**
 * 创建元件掩膜，将元件区域涂白（剔除）
 * 注意：elements[].contour 格式为 [{x, y}, {x, y}, ...]
 */
function createComponentMask(imageData, elements, width, height) {
  const data = new Uint8ClampedArray(imageData.data);
  
  // 创建掩膜画布
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  
  // 填充白色背景
  maskCtx.fillStyle = 'white';
  
  // 为每个元件绘制掩膜
  for (let elemIdx = 0; elemIdx < elements.length; elemIdx++) {
    const element = elements[elemIdx];
    if (!element.contour || element.contour.length < 3) {
      console.warn(`[WireDetection] 元件${elemIdx} (${element.name}) 轮廓数据不足，跳过`);
      continue;
    }
    
    // 轮廓格式：{x, y} 对象
    const firstPoint = element.contour[0];
    if (!firstPoint || firstPoint.x === undefined || firstPoint.y === undefined) {
      console.error(`[WireDetection] 元件${elemIdx} (${element.name}) 轮廓格式错误，跳过`);
      continue;
    }
    
    maskCtx.beginPath();
    maskCtx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < element.contour.length; i++) {
      const point = element.contour[i];
      maskCtx.lineTo(point.x, point.y);
    }
    
    maskCtx.closePath();
    maskCtx.fill();
  }
  
  // 获取掩膜数据
  const maskData = maskCtx.getImageData(0, 0, width, height).data;
  
  // 统计掩膜覆盖情况
  let maskedPixelCount = 0;
  for (let i = 0; i < maskData.length; i += 4) {
    if (maskData[i] > 200) {
      maskedPixelCount++;
    }
  }
  const totalPixels = width * height;
  const maskCoverage = (maskedPixelCount / totalPixels * 100).toFixed(2);
  console.log(`[WireDetection] 掩膜覆盖率: ${maskCoverage}% (${maskedPixelCount}/${totalPixels} 像素)`);
  
  if (maskedPixelCount === 0) {
    console.error(`[WireDetection] 警告：掩膜覆盖率为0，元件区域未被正确剔除！`);
  }
  
  // 应用掩膜：将元件区域设为白色
  for (let i = 0; i < data.length; i += 4) {
    if (maskData[i] > 200) { // 掩膜区域为白色
      data[i] = 255;     // R
      data[i + 1] = 255; // G
      data[i + 2] = 255; // B
    }
  }
  
  return new ImageData(data, width, height);
}

/**
 * 转换为灰度图
 */
function toGrayscale(imageData) {
  const data = new Uint8ClampedArray(imageData.data);
  const gray = new Uint8Array(imageData.width * imageData.height);
  
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    // 加权灰度转换
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  
  return gray;
}

/**
 * 自适应二值化（Otsu 方法简化版）
 */
function adaptiveBinarize(grayData, width, height) {
  const binary = new Uint8Array(width * height);
  
  // 计算直方图
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < grayData.length; i++) {
    histogram[grayData[i]]++;
  }
  
  // Otsu 阈值计算
  const total = grayData.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  
  let sumB = 0, wB = 0, wF = 0;
  let maxVariance = 0, threshold = 128;
  
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  
  // 应用阈值（导线通常是深色，所以小于阈值为1）
  for (let i = 0; i < grayData.length; i++) {
    binary[i] = grayData[i] < threshold ? 1 : 0;
  }
  
  return binary;
}

/**
 * 形态学清理：去除小噪点，填补小间隙
 */
function morphologicalClean(binaryData, width, height) {
  // 先膨胀再腐蚀（闭运算），填补小间隙
  const dilated = dilate(binaryData, width, height);
  const closed = erode(dilated, width, height);
  // 注意：对细线来说开运算会过度侵蚀，导致断线
  return closed;
}

/**
 * 腐蚀操作
 */
function erode(data, width, height) {
  const result = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // 3x3 邻域全为1才保留
      let allOne = true;
      for (let dy = -1; dy <= 1 && allOne; dy++) {
        for (let dx = -1; dx <= 1 && allOne; dx++) {
          if (data[(y + dy) * width + (x + dx)] === 0) {
            allOne = false;
          }
        }
      }
      result[idx] = allOne ? 1 : 0;
    }
  }
  
  return result;
}

/**
 * 膨胀操作
 */
function dilate(data, width, height) {
  const result = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // 3x3 邻域有任意1就膨胀
      let anyOne = false;
      for (let dy = -1; dy <= 1 && !anyOne; dy++) {
        for (let dx = -1; dx <= 1 && !anyOne; dx++) {
          if (data[(y + dy) * width + (x + dx)] === 1) {
            anyOne = true;
          }
        }
      }
      result[idx] = anyOne ? 1 : 0;
    }
  }
  
  return result;
}

/**
 * 高斯模糊（简化版 3x3 核）
 */
function gaussianBlur(grayData, width, height) {
  const result = new Uint8Array(width * height);
  
  // 高斯核（3x3，σ ≈ 1）
  const kernel = [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1
  ];
  const kernelSum = 16;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      let k = 0;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = (y + dy) * width + (x + dx);
          sum += grayData[idx] * kernel[k];
          k++;
        }
      }
      
      result[y * width + x] = Math.round(sum / kernelSum);
    }
  }
  
  // 边界复制
  for (let x = 0; x < width; x++) {
    result[x] = grayData[x]; // 上边界
    result[(height - 1) * width + x] = grayData[(height - 1) * width + x]; // 下边界
  }
  for (let y = 0; y < height; y++) {
    result[y * width] = grayData[y * width]; // 左边界
    result[y * width + width - 1] = grayData[y * width + width - 1]; // 右边界
  }
  
  return result;
}

/**
 * 连通域标记（Two-Pass 算法）
 * @returns { labelData: Uint32Array, blobCount: number }
 */
function connectedComponentLabeling(binaryData, width, height) {
  const labelData = new Uint32Array(width * height);
  let nextLabel = 1;
  const unionFind = new UnionFind();
  
  console.log('[WireDetection] CCL 第一遍：扫描并标记...');
  
  // 第一遍：扫描并标记
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      if (binaryData[idx] === 0) continue; // 背景
      
      // 检查左邻居和上邻居
      const leftIdx = (x > 0) ? idx - 1 : -1;
      const topIdx = (y > 0) ? idx - width : -1;
      
      const leftLabel = (leftIdx >= 0 && binaryData[leftIdx] === 1) ? labelData[leftIdx] : 0;
      const topLabel = (topIdx >= 0 && binaryData[topIdx] === 1) ? labelData[topIdx] : 0;
      
      if (leftLabel === 0 && topLabel === 0) {
        // 新标签
        labelData[idx] = nextLabel;
        unionFind.makeSet(nextLabel);
        nextLabel++;
      } else if (leftLabel !== 0 && topLabel === 0) {
        labelData[idx] = leftLabel;
      } else if (leftLabel === 0 && topLabel !== 0) {
        labelData[idx] = topLabel;
      } else {
        // 两者都有标签
        labelData[idx] = Math.min(leftLabel, topLabel);
        if (leftLabel !== topLabel) {
          unionFind.union(leftLabel, topLabel);
        }
      }
    }
  }
  
  console.log('[WireDetection] CCL 第二遍：合并等价标签...');
  
  // 第二遍：合并等价标签
  const labelMapping = new Map();
  let blobCount = 0;
  
  for (let i = 0; i < labelData.length; i++) {
    if (labelData[i] === 0) continue;
    
    const root = unionFind.find(labelData[i]);
    if (!labelMapping.has(root)) {
      blobCount++;
      labelMapping.set(root, blobCount);
    }
    labelData[i] = labelMapping.get(root);
  }
  
  console.log('[WireDetection] CCL 完成，初始标签数:', nextLabel - 1, '合并后 Blob 数:', blobCount);
  
  return { labelData, blobCount };
}

/**
 * Union-Find 数据结构（用于 CCL）
 */
class UnionFind {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }
  
  makeSet(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }
  
  find(x) {
    if (!this.parent.has(x)) {
      this.makeSet(x);
    }
    
    if (this.parent.get(x) !== x) {
      // 路径压缩
      this.parent.set(x, this.find(this.parent.get(x)));
    }
    
    return this.parent.get(x);
  }
  
  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    
    if (rootX === rootY) return;
    
    // 按秩合并
    const rankX = this.rank.get(rootX);
    const rankY = this.rank.get(rootY);
    
    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }
}

/**
 * 提取 Blob 信息并过滤小噪点
 */
function extractAndFilterBlobs(labelData, width, height, blobCount) {
  const MIN_BLOB_AREA = 20; // 最小面积阈值（像素）
  
  // 统计每个 Blob 的像素数和边界框
  const blobStats = new Map();
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = labelData[y * width + x];
      if (label === 0) continue;
      
      if (!blobStats.has(label)) {
        blobStats.set(label, {
          label,
          pixelCount: 0,
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          pixels: []
        });
      }
      
      const blob = blobStats.get(label);
      blob.pixelCount++;
      blob.minX = Math.min(blob.minX, x);
      blob.minY = Math.min(blob.minY, y);
      blob.maxX = Math.max(blob.maxX, x);
      blob.maxY = Math.max(blob.maxY, y);
      blob.pixels.push({ x, y });
    }
  }
  
  // 过滤小噪点
  const validBlobs = [];
  let filteredCount = 0;
  
  for (const [label, blob] of blobStats) {
    if (blob.pixelCount >= MIN_BLOB_AREA) {
      validBlobs.push({
        label,
        area: blob.pixelCount,
        bbox: {
          x: blob.minX,
          y: blob.minY,
          width: blob.maxX - blob.minX + 1,
          height: blob.maxY - blob.minY + 1
        },
        pixels: blob.pixels
      });
    } else {
      filteredCount++;
    }
  }
  
  console.log('[WireDetection] 过滤掉', filteredCount, '个小噪点，保留', validBlobs.length, '个有效 Blob');
  
  return validBlobs;
}

/**
 * Blob 与元件轮廓碰撞检测
 * 检测方法：Blob 的轮廓与元件的轮廓是否相交或接近
 */
function detectBlobElementConnections(blobs, elements) {
  const PROXIMITY_THRESHOLD = 4; // 接近阈值（像素）
  const MIN_CONTACT_PIXELS = 2;  // 最少接触像素数
  const connections = [];
  
  console.log('[WireDetection] 开始碰撞检测，Blob 数:', blobs.length, '元件数:', elements.length);
  
  for (let blobIdx = 0; blobIdx < blobs.length; blobIdx++) {
    const blob = blobs[blobIdx];
    const connectedElements = new Set();
    
    // 提取 Blob 的边界像素（用于加速）
    const blobBoundaryPixels = extractBlobBoundary(blob);
    
    for (let elemIdx = 0; elemIdx < elements.length; elemIdx++) {
      const element = elements[elemIdx];
      if (!element.contour || element.contour.length === 0) continue;
      
      // 检测 Blob 边界像素是否接近元件轮廓
      let isConnected = false;
      let contactCount = 0;
      
      for (const blobPixel of blobBoundaryPixels) {
        for (const contourPoint of element.contour) {
          const dist = Math.hypot(blobPixel.x - contourPoint.x, blobPixel.y - contourPoint.y);
          if (dist <= PROXIMITY_THRESHOLD) {
            contactCount++;
            if (contactCount >= MIN_CONTACT_PIXELS) {
              isConnected = true;
            }
            break;
          }
        }
        if (isConnected) break;
      }
      
      if (isConnected) {
        connectedElements.add(elemIdx);
      }
    }
    
    if (connectedElements.size > 0) {
      connections.push({
        blobIndex: blobIdx,
        blob,
        connectedElements: Array.from(connectedElements)
      });
      
      console.log(`[WireDetection] Blob ${blobIdx} 连接到元件:`, Array.from(connectedElements).map(idx => elements[idx].name));
    }
  }
  
  console.log('[WireDetection] 碰撞检测完成，有连接的 Blob 数:', connections.length);
  
  return connections;
}

/**
 * 提取 Blob 的边界像素（8-邻接）
 */
function extractBlobBoundary(blob) {
  const pixelSet = new Set(blob.pixels.map(p => `${p.x},${p.y}`));
  const boundary = [];
  
  const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];
  
  for (const pixel of blob.pixels) {
    let isBoundary = false;
    
    for (const [dx, dy] of offsets) {
      const neighborKey = `${pixel.x + dx},${pixel.y + dy}`;
      if (!pixelSet.has(neighborKey)) {
        isBoundary = true;
        break;
      }
    }
    
    if (isBoundary) {
      boundary.push(pixel);
    }
  }
  
  return boundary;
}

/**
 * 找到 Blob 边界上距离元件最近的像素点
 */
function findClosestBlobPixelToElement(blob, element) {
  if (!blob || !element || !element.contour || element.contour.length === 0) {
    return null;
  }
  
  const boundary = extractBlobBoundary(blob);
  if (boundary.length === 0) return null;
  
  let minDist = Infinity;
  let nearestPixel = null;
  
  for (const blobPixel of boundary) {
    for (const contourPoint of element.contour) {
      const dist = Math.hypot(blobPixel.x - contourPoint.x, blobPixel.y - contourPoint.y);
      if (dist < minDist) {
        minDist = dist;
        nearestPixel = { x: blobPixel.x, y: blobPixel.y };
      }
    }
  }
  
  return nearestPixel;
}

/**
 * 在 Blob 像素集合内寻找最短路径（8 邻接）
 */
function shortestPathOnBlob(blob, start, end) {
  if (!start || !end) return [];
  
  const pixelSet = new Set(blob.pixels.map(p => `${p.x},${p.y}`));
  const startKey = `${start.x},${start.y}`;
  const endKey = `${end.x},${end.y}`;
  
  if (!pixelSet.has(startKey) || !pixelSet.has(endKey)) {
    return [];
  }
  
  const queue = [];
  const visited = new Set();
  const prev = new Map();
  
  queue.push(startKey);
  visited.add(startKey);
  
  const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1]
  ];
  
  while (queue.length > 0) {
    const currentKey = queue.shift();
    if (currentKey === endKey) break;
    
    const [cx, cy] = currentKey.split(',').map(Number);
    for (const [dx, dy] of offsets) {
      const nx = cx + dx;
      const ny = cy + dy;
      const nKey = `${nx},${ny}`;
      if (!pixelSet.has(nKey) || visited.has(nKey)) continue;
      visited.add(nKey);
      prev.set(nKey, currentKey);
      queue.push(nKey);
    }
  }
  
  if (!visited.has(endKey)) return [];
  
  // 回溯路径
  const path = [];
  let cur = endKey;
  while (cur) {
    const [x, y] = cur.split(',').map(Number);
    path.push({ x, y });
    cur = prev.get(cur);
  }
  
  return path.reverse();
}

/**
 * 从 Blob 连接关系构建连接图
 */
function buildConnectionGraphFromBlobs(blobConnections, elements) {
  const graph = {
    nodes: [],
    edges: [],
    adjacency: {}
  };
  
  console.log('[WireDetection] 从 Blob 构建连接图，元件数:', elements.length);
  
  // 添加元件节点
  for (let i = 0; i < elements.length; i++) {
    const nodeId = `element_${i}`;
    graph.nodes.push({
      id: nodeId,
      type: 'element',
      elementIndex: i,
      elementType: elements[i].element_type,
      elementName: elements[i].name
    });
    graph.adjacency[nodeId] = [];
  }
  
  // 根据 Blob 连接关系添加边
  // 如果一个 Blob 同时连接了多个元件，则这些元件之间两两相连
  let edgeCount = 0;
  const addedEdges = new Set();
  
  for (const conn of blobConnections) {
    const elemIndices = conn.connectedElements;
    const blob = conn.blob;
    
    // 两两配对
    for (let i = 0; i < elemIndices.length; i++) {
      for (let j = i + 1; j < elemIndices.length; j++) {
        const elem1Idx = elemIndices[i];
        const elem2Idx = elemIndices[j];
        
        const edgeKey1 = `${elem1Idx}-${elem2Idx}`;
        const edgeKey2 = `${elem2Idx}-${elem1Idx}`;
        
        if (addedEdges.has(edgeKey1) || addedEdges.has(edgeKey2)) continue;
        
        // 使用 Blob 的实际像素构建真实路径
        const path = buildRealPathFromBlob(blob, elements[elem1Idx], elements[elem2Idx]);
        
        // 如果路径太短，使用简化路径
        if (path.length < 2) {
          console.warn(`[WireDetection] Blob ${conn.blobIndex} 路径构建失败，使用简化路径`);
          const blobCenterX = blob.bbox.x + blob.bbox.width / 2;
          const blobCenterY = blob.bbox.y + blob.bbox.height / 2;
          const elem1Center = getElementCenter(elements[elem1Idx]);
          const elem2Center = getElementCenter(elements[elem2Idx]);
          
          if (elem1Center && elem2Center) {
            path.push(elem1Center);
            path.push({ x: blobCenterX, y: blobCenterY });
            path.push(elem2Center);
          }
        }
        
        const edge = {
          from: `element_${elem1Idx}`,
          to: `element_${elem2Idx}`,
          blobIndex: conn.blobIndex,
          blobArea: conn.blob.area,
          path: path  // 真实的导线路径
        };
        
        graph.edges.push(edge);
        graph.adjacency[edge.from].push({ to: edge.to, blobIndex: conn.blobIndex, path: path });
        graph.adjacency[edge.to].push({ to: edge.from, blobIndex: conn.blobIndex, path: [...path].reverse() });
        
        addedEdges.add(edgeKey1);
        edgeCount++;
        
        console.log(`[WireDetection] 边${edgeCount}: ${elements[elem1Idx].name} <-> ${elements[elem2Idx].name} (Blob ${conn.blobIndex}, 路径点数: ${path.length})`);
      }
    }
  }
  
  console.log('[WireDetection] 连接图构建完成，边数:', edgeCount);
  
  // 输出每个元件的连接情况
  for (let i = 0; i < elements.length; i++) {
    const nodeId = `element_${i}`;
    const neighbors = graph.adjacency[nodeId] || [];
    console.log(`[WireDetection] 元件${i} (${elements[i].name}) 连接到:`, neighbors.length, '个元件');
  }
  
  return graph;
}

/**
 * 从 Blob 像素构建真实的导线路径
 * 使用中轴线提取 + 路径追踪 + 元件穿透
 */
function buildRealPathFromBlob(blob, elem1, elem2) {
  const pixels = blob.pixels;
  if (!pixels || pixels.length === 0) {
    return [];
  }
  
  // 获取元件中心
  const elem1Center = getElementCenter(elem1);
  const elem2Center = getElementCenter(elem2);
  
  if (!elem1Center || !elem2Center) {
    return [];
  }
  
  // 优先使用 Blob 像素最短路径（沿导线行走）
  const elem1BlobPoint = findClosestBlobPixelToElement(blob, elem1);
  const elem2BlobPoint = findClosestBlobPixelToElement(blob, elem2);
  let blobPath = shortestPathOnBlob(blob, elem1BlobPoint, elem2BlobPoint);
  
  // 回退：提取 Blob 的中轴线（每一列/行取中心点）
  if (blobPath.length === 0) {
    blobPath = extractBlobCenterline(blob, elem1Center, elem2Center);
  }
  
  if (blobPath.length === 0) {
    return [];
  }
  
  // 路径简化：Douglas-Peucker 算法
  const simplifiedPath = simplifyPath(blobPath, 3.0); // 容差5像素
  
  // 关键改进：让电流穿过元件
  const finalPath = [];
  
  // 1. 元件1的入口点（Blob起点最近的轮廓点）
  const elem1Entry = findNearestContourPoint(elem1, simplifiedPath[0]);
  if (elem1Entry) {
    finalPath.push(elem1Entry);
    // 穿过元件1中心
    finalPath.push(elem1Center);
    // 元件1的出口点（朝向Blob起点方向）
    const elem1Exit = findExitPoint(elem1, elem1Center, simplifiedPath[0]);
    if (elem1Exit) {
      finalPath.push(elem1Exit);
    }
  }
  
  // 2. 添加简化后的 Blob 路径（导线部分）
  finalPath.push(...simplifiedPath);
  
  // 3. 元件2的入口点（Blob终点最近的轮廓点）
  const blobEnd = simplifiedPath[simplifiedPath.length - 1];
  const elem2Entry = findNearestContourPoint(elem2, blobEnd);
  if (elem2Entry) {
    finalPath.push(elem2Entry);
    // 穿过元件2中心
    finalPath.push(elem2Center);
    // 元件2的出口点（朝向Blob终点方向）
    const elem2Exit = findExitPoint(elem2, elem2Center, blobEnd);
    if (elem2Exit) {
      finalPath.push(elem2Exit);
    }
  }
  
  console.log(`[WireDetection] Blob 路径: ${pixels.length}像素 -> ${blobPath.length}中轴点 -> ${simplifiedPath.length}简化点 -> ${finalPath.length}最终点（含元件穿透）`);
  
  return finalPath;
}

/**
 * 找到元件轮廓上距离指定点最近的点（入口点）
 */
function findNearestContourPoint(element, targetPoint) {
  if (!element.contour || element.contour.length === 0 || !targetPoint) {
    return null;
  }
  
  let minDist = Infinity;
  let nearestPoint = null;
  
  for (const contourPoint of element.contour) {
    const dist = Math.hypot(contourPoint.x - targetPoint.x, contourPoint.y - targetPoint.y);
    if (dist < minDist) {
      minDist = dist;
      nearestPoint = { x: contourPoint.x, y: contourPoint.y };
    }
  }
  
  return nearestPoint;
}

/**
 * 找到元件轮廓上的出口点（相对于中心点，在入口点对侧）
 */
function findExitPoint(element, centerPoint, targetDirection) {
  if (!element.contour || element.contour.length === 0 || !centerPoint || !targetDirection) {
    return null;
  }
  
  // 计算从中心指向目标方向的向量
  const dirX = targetDirection.x - centerPoint.x;
  const dirY = targetDirection.y - centerPoint.y;
  const dirLength = Math.hypot(dirX, dirY);
  
  if (dirLength === 0) {
    // 如果方向向量为0，返回轮廓上距离中心最远的点
    let maxDist = 0;
    let farthestPoint = null;
    
    for (const contourPoint of element.contour) {
      const dist = Math.hypot(contourPoint.x - centerPoint.x, contourPoint.y - centerPoint.y);
      if (dist > maxDist) {
        maxDist = dist;
        farthestPoint = { x: contourPoint.x, y: contourPoint.y };
      }
    }
    
    return farthestPoint;
  }
  
  // 归一化方向向量
  const normDirX = dirX / dirLength;
  const normDirY = dirY / dirLength;
  
  // 找到轮廓上投影最大的点（沿着方向向量）
  let maxProjection = -Infinity;
  let exitPoint = null;
  
  for (const contourPoint of element.contour) {
    const vecX = contourPoint.x - centerPoint.x;
    const vecY = contourPoint.y - centerPoint.y;
    
    // 点积：投影到方向向量上
    const projection = vecX * normDirX + vecY * normDirY;
    
    if (projection > maxProjection) {
      maxProjection = projection;
      exitPoint = { x: contourPoint.x, y: contourPoint.y };
    }
  }
  
  return exitPoint;
}

/**
 * 提取 Blob 的中轴线
 * 方法：沿主方向扫描，每个切片取中心点
 */
function extractBlobCenterline(blob, startPoint, endPoint) {
  const pixels = blob.pixels;
  const centerline = [];
  
  // 判断主方向：从起点到终点的方向
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const isHorizontalDominant = Math.abs(dx) > Math.abs(dy);
  
  // 创建像素集合用于快速查找
  const pixelSet = new Map();
  for (const p of pixels) {
    const key = `${p.x},${p.y}`;
    pixelSet.set(key, p);
  }
  
  if (isHorizontalDominant) {
    // 主方向是水平，按 x 分组
    const xGroups = new Map();
    for (const p of pixels) {
      if (!xGroups.has(p.x)) {
        xGroups.set(p.x, []);
      }
      xGroups.get(p.x).push(p.y);
    }
    
    // 按 x 排序，取每组的中心 y
    const sortedX = Array.from(xGroups.keys()).sort((a, b) => a - b);
    for (const x of sortedX) {
      const yValues = xGroups.get(x);
      const centerY = (Math.min(...yValues) + Math.max(...yValues)) / 2;
      centerline.push({ x, y: Math.round(centerY) });
    }
  } else {
    // 主方向是垂直，按 y 分组
    const yGroups = new Map();
    for (const p of pixels) {
      if (!yGroups.has(p.y)) {
        yGroups.set(p.y, []);
      }
      yGroups.get(p.y).push(p.x);
    }
    
    // 按 y 排序，取每组的中心 x
    const sortedY = Array.from(yGroups.keys()).sort((a, b) => a - b);
    for (const y of sortedY) {
      const xValues = yGroups.get(y);
      const centerX = (Math.min(...xValues) + Math.max(...xValues)) / 2;
      centerline.push({ x: Math.round(centerX), y });
    }
  }
  
  return centerline;
}

/**
 * 路径简化（Douglas-Peucker 算法）
 * @param {Array} points - 原始路径点
 * @param {number} tolerance - 容差（像素）
 */
function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;
  
  // 找到距离起点-终点连线最远的点
  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToLineDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  // 如果最大距离超过容差，递归简化
  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    
    // 合并（去掉重复的中间点）
    return [...left.slice(0, -1), ...right];
  } else {
    // 否则只保留起点和终点
    return [start, end];
  }
}

/**
 * 计算点到线段的距离
 */
function pointToLineDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    // 线段退化为点
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  
  const t = Math.max(0, Math.min(1, 
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy)
  ));
  
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  
  return Math.hypot(point.x - projX, point.y - projY);
}

/**
 * 计算元件轮廓的中心点
 */
function getElementCenter(element) {
  if (!element.contour || element.contour.length === 0) return null;
  
  let sumX = 0, sumY = 0;
  for (const point of element.contour) {
    sumX += point.x;
    sumY += point.y;
  }
  
  return {
    x: sumX / element.contour.length,
    y: sumY / element.contour.length
  };
}

/**
 * 调试：将标签数据渲染到画布（彩色显示不同的 Blob）
 */
export function renderLabelsToCanvas(labelData, width, height, blobCount, canvas) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  
  // 为每个 Blob 生成随机颜色
  const colors = new Map();
  colors.set(0, [255, 255, 255]); // 背景为白色
  
  for (let i = 1; i <= blobCount; i++) {
    colors.set(i, [
      Math.floor(Math.random() * 200 + 55),  // R
      Math.floor(Math.random() * 200 + 55),  // G
      Math.floor(Math.random() * 200 + 55)   // B
    ]);
  }
  
  for (let i = 0; i < labelData.length; i++) {
    const label = labelData[i];
    const color = colors.get(label) || [128, 128, 128];
    const idx = i * 4;
    
    imageData.data[idx] = color[0];
    imageData.data[idx + 1] = color[1];
    imageData.data[idx + 2] = color[2];
    imageData.data[idx + 3] = 255;
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * 调试：在画布上绘制 Blob 边界和连接关系
 */
export function renderDebugOverlay(ctx, blobs, blobConnections, elements) {
  // 绘制 Blob 边界（绿色）
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;
  
  for (const blob of blobs) {
    const boundary = extractBlobBoundary(blob);
    
    if (boundary.length > 0) {
      ctx.beginPath();
      ctx.moveTo(boundary[0].x, boundary[0].y);
      for (let i = 1; i < boundary.length; i++) {
        ctx.lineTo(boundary[i].x, boundary[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      
      // 绘制 Blob 中心点
      const centerX = blob.bbox.x + blob.bbox.width / 2;
      const centerY = blob.bbox.y + blob.bbox.height / 2;
      ctx.fillStyle = 'blue';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // 绘制连接关系（红色虚线）
  ctx.strokeStyle = 'red';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 2;
  
  for (const conn of blobConnections) {
    const blob = conn.blob;
    const blobCenterX = blob.bbox.x + blob.bbox.width / 2;
    const blobCenterY = blob.bbox.y + blob.bbox.height / 2;
    
    for (const elemIdx of conn.connectedElements) {
      const element = elements[elemIdx];
      if (!element.contour || element.contour.length === 0) continue;
      
      // 找到元件轮廓的中心点
      let sumX = 0, sumY = 0;
      for (const point of element.contour) {
        sumX += point.x;
        sumY += point.y;
      }
      const elemCenterX = sumX / element.contour.length;
      const elemCenterY = sumY / element.contour.length;
      
      // 绘制连接线
      ctx.beginPath();
      ctx.moveTo(blobCenterX, blobCenterY);
      ctx.lineTo(elemCenterX, elemCenterY);
      ctx.stroke();
    }
  }
  
  ctx.setLineDash([]);
}
