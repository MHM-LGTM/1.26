/**
 * 电学场景输入框组件
 * ---------------------------------
 * 功能：
 * - 支持点击/拖拽上传电路图
 * - 调用后端 AI 识别电学元件
 * - 使用 SAM 分割电学元件
 * - 识别导线连接关系（前端算法）
 * - 渲染电流流向动画（纯 Canvas，不使用 Matter.js）
 * - 参数调节实时生效
 * 
 * 与 PhysicsInputBox 的区别：
 * - 不使用 Matter.js 物理引擎
 * - 使用导线识别算法
 * - 电流粒子渲染引擎
 * - 参数实时生效
 * 
 * 2026-02-01 创建
 */

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { health as apiHealth } from '../api/physicsApi.js';
import { uploadCircuitImage, segment } from '../api/electricApi.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import ErrorToast from './ErrorToast.jsx';
import ElectricParametersPanel from './ElectricParametersPanel.jsx';
import { drawContour, clear, drawDragRect } from '../utils/drawMask.js';
import { ELECTRIC_ELEMENTS, getDefaultParameters } from './electric/elementTypes.js';
import { detectWires } from '../utils/electric/wireDetection.js';
import { analyzeCircuit, hasOpenSwitch } from '../utils/electric/circuitAnalysis.js';
import { createCurrentRenderer } from '../utils/electric/currentRenderer.js';
import { showToast } from '../utils/toast.js';
import { useTranslation } from 'react-i18next';

const ElectricInputBox = forwardRef(({ animationSource, plazaAnimationInfo, onClosePlazaInfo, onClearPlazaSelection }, ref) => {
  const { t } = useTranslation();
  // ============================================================================
  // 基础状态
  // ============================================================================
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 图片相关
  const [imagePreview, setImagePreview] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const [imageNaturalSize, setImageNaturalSize] = useState({ w: 0, h: 0 });

  // SAM 分割相关
  const [contour, setContour] = useState([]);
  const [lastImageContour, setLastImageContour] = useState([]);

  // AI 识别结果
  const [recognizedElements, setRecognizedElements] = useState([]);  // AI 识别的元件
  const [pendingElements, setPendingElements] = useState([]);        // 待分配元件
  const [assignments, setAssignments] = useState([]);                 // 已分配元件

  // 模拟状态
  const [isSimulating, setIsSimulating] = useState(false);           // 是否正在模拟
  const [isSegmentationDisabled, setIsSegmentationDisabled] = useState(false);

  // 导线识别结果
  const [wireConnections, setWireConnections] = useState([]);        // 导线连接关系
  const [circuitNetlist, setCircuitNetlist] = useState(null);        // 电路网表
  const isSimulatingRef = useRef(false);                             // 模拟状态 ref
  
  // 🔧 调试模式
  const [debugMode, setDebugMode] = useState(false);                 // 调试模式开关

  // 弹窗相关
  const [lastMousePos, setLastMousePos] = useState(null);
  const [popupOffset, setPopupOffset] = useState({ x: 0, y: 0 });
  const [isDraggingPopup, setIsDraggingPopup] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  // AI 识别耗时
  const [embedMs, setEmbedMs] = useState(null);
  const [aiMs, setAiMs] = useState(null);

  // ============================================================================
  // Refs
  // ============================================================================
  const uploadRef = useRef(null);
  const canvasRef = useRef(null);        // SAM 分割画布
  const imgRef = useRef(null);
  const simCanvasRef = useRef(null);     // 电流动画画布
  const animationFrameRef = useRef(null); // 动画帧 ID
  const rendererRef = useRef(null);       // 电流渲染器
  const circuitDataRef = useRef(null);    // 电路数据缓存

  // 框选拖拽状态
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });

  // ============================================================================
  // 暴露给父组件的方法
  // ============================================================================
  useImperativeHandle(ref, () => ({
    loadAnimation: (sceneData, plazaAnimationId = null) => {
      console.log('[ElectricInputBox] loadAnimation 被调用');
      // TODO: 实现电学动画加载
      showToast.info(t('electricDevelopingHint'));
    },
    triggerUpload: () => {
      handleClickUpload();
    }
  }));

  // ============================================================================
  // 初始化
  // ============================================================================
  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize);
    return () => {
      window.removeEventListener('resize', syncCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // 清理渲染器
      if (rendererRef.current) {
        rendererRef.current.clear();
      }
    };
  }, []);

  // ============================================================================
  // Canvas 尺寸同步
  // ============================================================================
  const syncCanvasSize = () => {
    if (!canvasRef.current) return;
    const target = imgRef.current;
    if (target) {
      const w = target.clientWidth;
      const h = target.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      
      // SAM 分割画布
      canvasRef.current.width = Math.max(1, Math.floor(w * dpr));
      canvasRef.current.height = Math.max(1, Math.floor(h * dpr));
      canvasRef.current.style.width = `${Math.max(1, w)}px`;
      canvasRef.current.style.height = `${Math.max(1, h)}px`;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 电流动画画布
      if (simCanvasRef.current) {
        simCanvasRef.current.width = Math.max(1, Math.floor(w * dpr));
        simCanvasRef.current.height = Math.max(1, Math.floor(h * dpr));
        simCanvasRef.current.style.width = `${Math.max(1, w)}px`;
        simCanvasRef.current.style.height = `${Math.max(1, h)}px`;
        const simCtx = simCanvasRef.current.getContext('2d');
        if (simCtx) simCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  };

  // ============================================================================
  // 坐标转换
  // ============================================================================
  const toCanvasPoints = (rawPoints, rect) => {
    const arr = Array.isArray(rawPoints) ? rawPoints : [];
    const normalized = arr.map((p) => (Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number(p?.x ?? 0), y: Number(p?.y ?? 0) }));
    const canvasW = Math.floor(rect.width);
    const canvasH = Math.floor(rect.height);
    const naturalW = imageNaturalSize.w || canvasW;
    const naturalH = imageNaturalSize.h || canvasH;
    const scaleX = naturalW ? canvasW / naturalW : 1;
    const scaleY = naturalH ? canvasH / naturalH : 1;
    return normalized.map((pt) => ({ x: Math.round(pt.x * scaleX), y: Math.round(pt.y * scaleY) }));
  };

  const toImagePoint = (pt, rect) => {
    const canvasW = Math.floor(rect.width);
    const canvasH = Math.floor(rect.height);
    const naturalW = imageNaturalSize.w || canvasW;
    const naturalH = imageNaturalSize.h || canvasH;
    const scaleX = naturalW ? naturalW / canvasW : 1;
    const scaleY = naturalH ? naturalH / canvasH : 1;
    return { x: Math.round(pt.x * scaleX), y: Math.round(pt.y * scaleY) };
  };

  const toImageBox = (x1, y1, x2, y2, rect) => {
    const p1 = toImagePoint({ x: x1, y: y1 }, rect);
    const p2 = toImagePoint({ x: x2, y: y2 }, rect);
    return [p1.x, p1.y, p2.x, p2.y];
  };

  // ============================================================================
  // 图片上传
  // ============================================================================
  const onFilePicked = async (file) => {
    if (!file) return;
    setError('');
    setLoading(true);
    
    // 重置状态
    setAssignments([]);
    setWireConnections([]);
    setCircuitNetlist(null);
    setIsSimulating(false);
    setIsSegmentationDisabled(false);
    
    try {
      const localUrl = URL.createObjectURL(file);
      setImagePreview(localUrl);
      
      // 保存原始图片 URL
      const reader = new FileReader();
      reader.onload = (e) => setOriginalImageUrl(e.target.result);
      reader.readAsDataURL(file);

      // 调用电学上传 API
      const resp = await uploadCircuitImage(file);
      const data = resp?.data || {};
      
      setImagePath(data?.path || '');
      setEmbedMs(typeof data?.embed_ms === 'number' ? data.embed_ms : null);
      setAiMs(typeof data?.ai_ms === 'number' ? data.ai_ms : null);
      
      // 处理识别到的电学元件
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      setRecognizedElements(elements);
      setPendingElements(elements);
      
      console.log('[ElectricInputBox] AI 识别到的元件:', elements);
      
      // 【2026-02-05 新增】上传新图片时清除广场动画的高亮状态
      if (onClearPlazaSelection) {
        onClearPlazaSelection();
      }
      
    } catch (e) {
      console.error('[ElectricInputBox] 上传失败:', e);
      setError(e?.response?.data?.message || e?.message || t('uploadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = (ev) => {
    const newSize = { w: ev.target.naturalWidth, h: ev.target.naturalHeight };
    setImageNaturalSize(newSize);
    console.log('[ElectricInputBox] 图片加载完成，尺寸:', newSize);
    syncCanvasSize();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    onFilePicked(file);
  };

  const handleClickUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (ev) => onFilePicked(ev.target.files[0]);
    input.click();
  };

  // ============================================================================
  // SAM 分割交互
  // ============================================================================
  const handleMouseDown = (ev) => {
    if (!canvasRef.current || !imagePath) return;
    if (isSegmentationDisabled) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(ev.clientX - rect.left);
    const y = Math.floor(ev.clientY - rect.top);
    setDragStart({ x, y });
    setDragEnd({ x, y });
    setDragging(true);
  };

  const handleMouseMove = (ev) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(ev.clientX - rect.left);
    const y = Math.floor(ev.clientY - rect.top);
    setDragEnd({ x, y });
    
    const ctx = canvasRef.current.getContext('2d');
    clear(ctx, Math.floor(rect.width), Math.floor(rect.height));
    
    const x1 = Math.min(dragStart.x, x);
    const y1 = Math.min(dragStart.y, y);
    const x2 = Math.max(dragStart.x, x);
    const y2 = Math.max(dragStart.y, y);
    drawDragRect(ctx, x1, y1, x2, y2);
  };

  const handleMouseUp = async (ev) => {
    if (!canvasRef.current || !imagePath) return;
    if (isSegmentationDisabled) {
      setDragging(false);
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const imgRect = imgRef.current?.getBoundingClientRect?.() || canvasRect;
    const x = Math.floor(ev.clientX - canvasRect.left);
    const y = Math.floor(ev.clientY - canvasRect.top);

    const start = dragStart;
    const end = { x, y };
    setDragEnd(end);
    setDragging(false);
    setLastMousePos({ x, y });

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    const width = Math.floor(canvasRect.width);
    const height = Math.floor(canvasRect.height);
    const naturalW = imageNaturalSize.w || width;
    const naturalH = imageNaturalSize.h || height;

    setLoading(true);
    setError('');
    try {
      let resp;
      if (dist < 3) {
        const imgPt = toImagePoint(end, imgRect);
        resp = await segment({ image_path: imagePath, image_size: [naturalH, naturalW], points: [{ x: imgPt.x, y: imgPt.y }] });
      } else {
        const x1 = Math.min(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const x2 = Math.max(start.x, end.x);
        const y2 = Math.max(start.y, end.y);
        const imgBox = toImageBox(x1, y1, x2, y2, imgRect);
        resp = await segment({ image_path: imagePath, image_size: [naturalH, naturalW], box: imgBox });
      }
      
      if (resp?.code !== 0) throw new Error(resp?.message || 'segment failed');
      
      const rawPts = resp?.data?.contour || [];
      const pts = toCanvasPoints(rawPts, imgRect);
      setContour(pts);
      setLastImageContour(rawPts.map((p) => ({ x: Number(p?.x ?? 0), y: Number(p?.y ?? 0) })));
      
      const ctx = canvasRef.current.getContext('2d');
      clear(ctx, width, height);
      drawContour(ctx, pts);
      
      if (!pts || pts.length === 0) {
        setError(t('noSegmentContour'));
      }
    } catch (e) {
      console.error('[ElectricInputBox] 分割失败:', e);
      setError(t('segmentFailed', { message: e?.message || '' }));
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // 元件分配
  // ============================================================================
  const assignCurrentSelection = (elem, idx) => {
    if (!elem || !lastImageContour || lastImageContour.length === 0) return;

    setPopupOffset({ x: 0, y: 0 });

    // 获取默认参数
    const defaultParams = getDefaultParameters(elem.element_type);

    const newAssignment = {
      label: elem.visual_description || elem.name,
      name: elem.name,
      element_type: elem.element_type,
      contour: lastImageContour,
      parameters: { ...defaultParams, ...elem.parameters }
    };

    setAssignments((prev) => [...prev, newAssignment]);
    setPendingElements((prev) => prev.filter((_, i) => i !== idx));

    // 清除当前选择
    setContour([]);
    setLastImageContour([]);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      clear(ctx, canvasRef.current.width, canvasRef.current.height);
    }

    console.log('[ElectricInputBox] 分配元件:', newAssignment);
  };

  // ============================================================================
  // 参数变化处理（实时生效）
  // ============================================================================
  const handleParametersChange = (elementIndex, paramName, value) => {
    console.log('[ElectricInputBox] 参数变化:', elementIndex, paramName, value);
    
    // 更新元件参数
    const updatedAssignments = [...assignments];
    if (updatedAssignments[elementIndex]) {
      updatedAssignments[elementIndex] = {
        ...updatedAssignments[elementIndex],
        parameters: {
          ...updatedAssignments[elementIndex].parameters,
          [paramName]: value
        }
      };
    }
    setAssignments(updatedAssignments);

    // 如果正在模拟，立即重新计算电路并更新动画
    if (isSimulating && rendererRef.current && circuitDataRef.current) {
      console.log('[ElectricInputBox] 参数变化，实时更新电路...');
      
      // 检查开关状态
      if (hasOpenSwitch(updatedAssignments)) {
        // 开关断开，停止动画但保持模拟状态
        rendererRef.current.clear();
        setError(t('switchOpenCircuitError'));
        return;
      } else {
        setError('');
      }
      
      // 重新分析电路
      const newCircuitData = analyzeCircuit(circuitDataRef.current.connectionGraph || wireConnections, updatedAssignments);
      circuitDataRef.current = { ...circuitDataRef.current, ...newCircuitData };
      setCircuitNetlist(newCircuitData);
      
      // 转换坐标系统
      const naturalW = imageNaturalSize.w || imgRef.current.naturalWidth;
      const naturalH = imageNaturalSize.h || imgRef.current.naturalHeight;
      const canvasW = imgRef.current.clientWidth;
      const canvasH = imgRef.current.clientHeight;
      const scaleX = canvasW / naturalW;
      const scaleY = canvasH / naturalH;
      
      const transformedCircuitData = {
        ...newCircuitData,
        branches: newCircuitData.branches.map(branch => ({
          ...branch,
          wirePaths: branch.wirePaths.map(wirePath => 
            wirePath.map(point => ({
              x: point.x * scaleX,
              y: point.y * scaleY
            }))
          )
        }))
      };
      
      // 更新渲染器参数
      rendererRef.current.updateParameters(transformedCircuitData, updatedAssignments);
    }
  };

  // ============================================================================
  // 开始模拟
  // ============================================================================
  const handleStartSimulate = async () => {
    if (isSimulating) {
      // 停止模拟
      stopSimulation();
      return;
    }

    if (assignments.length === 0) {
      setError(t('selectAtLeastOneComponent'));
      return;
    }

    // 检查是否有电源
    const hasBattery = assignments.some(a => a.element_type === 'battery');
    if (!hasBattery) {
      setError(t('selectBattery'));
      return;
    }

    // 检查开关状态
    if (hasOpenSwitch(assignments)) {
      setError(t('openSwitchError'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('[ElectricInputBox] 开始模拟，元件数量:', assignments.length);
      
      // 第一步 - 导线识别（Blob 连通域分析）
      console.log('[ElectricInputBox] 步骤1: 导线识别（Blob 方法）...');
      let connectionGraph = null;
      let blobs = null;
      
      try {
        const wireResult = await detectWires(imgRef.current, assignments);
        console.log('[ElectricInputBox] 导线识别完成:', wireResult);
        console.log('[ElectricInputBox] Blob 数量:', wireResult.blobs?.length || 0);
        console.log('[ElectricInputBox] Blob 连接数:', wireResult.blobConnections?.length || 0);
        console.log('[ElectricInputBox] 连接图边数:', wireResult.connectionGraph?.edges?.length || 0);
        
        if (wireResult.connectionGraph && wireResult.connectionGraph.edges.length > 0) {
          connectionGraph = wireResult.connectionGraph;
          blobs = wireResult.blobs;
          setWireConnections(wireResult.blobConnections);
        } else {
          console.warn('[ElectricInputBox] Blob 方法未找到有效连接');
        }
      } catch (wireError) {
        console.error('[ElectricInputBox] 导线识别失败:', wireError);
      }
      
      // 如果导线识别失败，使用简化的串联模式
      if (!connectionGraph || connectionGraph.edges.length === 0) {
        console.log('[ElectricInputBox] 导线识别失败，使用简化串联模式...');
        connectionGraph = createSimplifiedCircuit(assignments);
      }
      
      // 第二步 - 电路拓扑分析
      console.log('[ElectricInputBox] 步骤2: 电路分析...');
      const circuitData = analyzeCircuit(connectionGraph, assignments);
      setCircuitNetlist(circuitData);
      circuitDataRef.current = { ...circuitData, connectionGraph, blobs };
      console.log('[ElectricInputBox] 电路分析完成:', circuitData);
      console.log('[ElectricInputBox] 支路数量:', circuitData.branches?.length || 0);
      
      if (circuitData.error) {
        setError(circuitData.error);
        setLoading(false);
        return;
      }
      
      // 检查是否有有效支路
      if (!circuitData.branches || circuitData.branches.length === 0) {
        console.warn('[ElectricInputBox] 未找到有效电路支路');
        if (debugMode) {
          // 调试模式下显示连接图
          console.log('[ElectricInputBox] 🔧 调试模式：显示连接图（无有效支路）');
          setIsSimulating(true);
          isSimulatingRef.current = true;
          setIsSegmentationDisabled(true);
          renderDebugView(circuitData, connectionGraph, blobs);
        } else {
          // 普通模式下使用演示动画
          console.log('[ElectricInputBox] 使用演示模式');
          setIsSimulating(true);
          isSimulatingRef.current = true;
          setIsSegmentationDisabled(true);
          startDemoAnimation();
        }
        return;
      }
      
      // 检测短路警告
      if (circuitData.shortCircuits && circuitData.shortCircuits.length > 0) {
        console.warn('[ElectricInputBox] 检测到短路!', circuitData.shortCircuits);
      }
      
      // 第三步 - 启动电流动画或调试视图
      if (debugMode) {
        console.log('[ElectricInputBox] 🔧 调试模式：显示连接关系...');
        setIsSimulating(true);
        isSimulatingRef.current = true;
        setIsSegmentationDisabled(true);
        renderDebugView(circuitData, connectionGraph, blobs);
      } else {
        console.log('[ElectricInputBox] 步骤3: 启动电流动画...');
        setIsSimulating(true);
        isSimulatingRef.current = true;
        setIsSegmentationDisabled(true);
        startCurrentAnimation(circuitData);
      }
      
    } catch (e) {
      console.error('[ElectricInputBox] 模拟失败:', e);
      setError(e?.message || t('simulationFailed'));
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // 停止模拟
  // ============================================================================
  const stopSimulation = () => {
    setIsSimulating(false);
    isSimulatingRef.current = false;
    setIsSegmentationDisabled(false);
    
    // 停止动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // 停止渲染器
    if (rendererRef.current) {
      rendererRef.current.clear();
      rendererRef.current = null;
    }
    
    // 清空动画画布
    if (simCanvasRef.current) {
      const ctx = simCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, simCanvasRef.current.width, simCanvasRef.current.height);
    }
    
    // 清空电路数据
    circuitDataRef.current = null;
    setCircuitNetlist(null);
    setWireConnections([]);
  };

  // ============================================================================
  // 创建简化的串联电路（当导线识别失败时使用）
  // ============================================================================
  const createSimplifiedCircuit = (elements) => {
    const graph = {
      nodes: [],
      edges: [],
      adjacency: {}
    };
    
    // 添加所有元件为节点
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
    
    // 找到电源
    const batteryIdx = elements.findIndex(e => e.element_type === 'battery');
    if (batteryIdx === -1) return graph;
    
    // 简单串联：电源 -> 其他元件 -> 电源
    const otherElements = elements.map((_, i) => i).filter(i => i !== batteryIdx);
    
    if (otherElements.length === 0) return graph;
    
    // 获取坐标转换比例（不需要 DPR，因为 canvas 已经通过 setTransform 处理了）
    const imgElement = imgRef.current;
    if (!imgElement) {
      console.error('[ElectricInputBox] 无法获取图像元素');
      return graph;
    }
    
    const naturalW = imageNaturalSize.w || imgElement.naturalWidth;
    const naturalH = imageNaturalSize.h || imgElement.naturalHeight;
    const canvasW = imgElement.clientWidth;
    const canvasH = imgElement.clientHeight;
    
    // 坐标转换：图像坐标 → 画布逻辑坐标（不乘 DPR）
    const scaleX = canvasW / naturalW;
    const scaleY = canvasH / naturalH;
    
    console.log('[ElectricInputBox] 坐标转换比例:', { 
      naturalSize: `${naturalW}x${naturalH}`, 
      canvasSize: `${canvasW}x${canvasH}`,
      scale: `${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`
    });
    
    // 从元件轮廓中心创建路径点（并转换坐标）
    // 注意：contour 格式为 [{x, y}, {x, y}, ...]
    const getCenter = (elem) => {
      if (!elem.contour || elem.contour.length === 0) {
        return { x: 100 * scaleX, y: 100 * scaleY };
      }
      let sumX = 0, sumY = 0;
      for (const p of elem.contour) {
        sumX += p.x;
        sumY += p.y;
      }
      // 转换到画布逻辑坐标
      return { 
        x: (sumX / elem.contour.length) * scaleX, 
        y: (sumY / elem.contour.length) * scaleY 
      };
    };
    
    // 电源 -> 第一个元件
    const batteryCenter = getCenter(elements[batteryIdx]);
    let prevIdx = batteryIdx;
    
    console.log('[ElectricInputBox] 元件中心坐标:');
    console.log(`  电源[${batteryIdx}]: (${batteryCenter.x.toFixed(1)}, ${batteryCenter.y.toFixed(1)})`);
    
    for (let i = 0; i < otherElements.length; i++) {
      const currIdx = otherElements[i];
      const currCenter = getCenter(elements[currIdx]);
      const prevCenter = getCenter(elements[prevIdx]);
      
      console.log(`  元件[${currIdx}] (${elements[currIdx].name}): (${currCenter.x.toFixed(1)}, ${currCenter.y.toFixed(1)})`);
      
      const path = [prevCenter, currCenter];
      
      graph.edges.push({
        from: `element_${prevIdx}`,
        to: `element_${currIdx}`,
        path
      });
      graph.adjacency[`element_${prevIdx}`].push({ to: `element_${currIdx}`, path });
      graph.adjacency[`element_${currIdx}`].push({ to: `element_${prevIdx}`, path: [...path].reverse() });
      
      prevIdx = currIdx;
    }
    
    // 最后一个元件 -> 电源（闭合回路）
    const lastCenter = getCenter(elements[prevIdx]);
    const closePath = [lastCenter, batteryCenter];
    graph.edges.push({
      from: `element_${prevIdx}`,
      to: `element_${batteryIdx}`,
      path: closePath
    });
    graph.adjacency[`element_${prevIdx}`].push({ to: `element_${batteryIdx}`, path: closePath });
    graph.adjacency[`element_${batteryIdx}`].push({ to: `element_${prevIdx}`, path: [...closePath].reverse() });
    
    console.log('[ElectricInputBox] 简化电路图构建完成，边数:', graph.edges.length);
    return graph;
  };

  // ============================================================================
  // 演示动画（当无法分析电路时显示基本效果）
  // ============================================================================
  const startDemoAnimation = () => {
    if (!simCanvasRef.current || !imgRef.current) return;
    
    syncCanvasSize();
    
    const canvas = simCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 获取坐标转换比例（不需要 DPR）
    const naturalW = imageNaturalSize.w || imgRef.current.naturalWidth;
    const naturalH = imageNaturalSize.h || imgRef.current.naturalHeight;
    const canvasW = imgRef.current.clientWidth;
    const canvasH = imgRef.current.clientHeight;
    const scaleX = canvasW / naturalW;
    const scaleY = canvasH / naturalH;
    
    console.log('[ElectricInputBox] 演示动画坐标转换:', { 
      naturalSize: `${naturalW}x${naturalH}`, 
      canvasSize: `${canvasW}x${canvasH}`,
      scale: `${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`
    });
    
    // 获取元件中心点（转换为画布逻辑坐标）
    // 注意：contour 格式为 [{x, y}, {x, y}, ...]
    const centers = assignments.map(elem => {
      if (!elem.contour || elem.contour.length === 0) return null;
      let sumX = 0, sumY = 0;
      for (const p of elem.contour) {
        sumX += p.x;
        sumY += p.y;
      }
      return { 
        x: (sumX / elem.contour.length) * scaleX, 
        y: (sumY / elem.contour.length) * scaleY,
        type: elem.element_type 
      };
    }).filter(c => c !== null);
    
    // 创建粒子
    const particles = [];
    for (let i = 0; i < 20; i++) {
      particles.push({
        progress: i / 20,
        speed: 0.005 + Math.random() * 0.003
      });
    }
    
    // 动画循环
    const animate = () => {
      if (!isSimulatingRef.current) return;
      
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      
      // 绘制元件效果
      for (const center of centers) {
        if (center.type === 'lamp') {
          // 灯泡发光
          const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, 40);
          gradient.addColorStop(0, 'rgba(255, 255, 150, 0.6)');
          gradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(center.x, center.y, 40, 0, Math.PI * 2);
          ctx.fill();
        } else if (center.type === 'resistor') {
          // 电阻发热
          ctx.fillStyle = 'rgba(255, 100, 50, 0.3)';
          ctx.shadowColor = 'orange';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(center.x, center.y, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      
      // 绘制沿轮廓运动的粒子
      for (const particle of particles) {
        particle.progress += particle.speed;
        if (particle.progress >= 1) particle.progress = 0;
        
        // 在元件之间移动
        const totalCenters = centers.length;
        if (totalCenters < 2) continue;
        
        const segmentProgress = particle.progress * totalCenters;
        const segmentIndex = Math.floor(segmentProgress) % totalCenters;
        const localProgress = segmentProgress - segmentIndex;
        
        const from = centers[segmentIndex];
        const to = centers[(segmentIndex + 1) % totalCenters];
        
        const x = from.x + (to.x - from.x) * localProgress;
        const y = from.y + (to.y - from.y) * localProgress;
        
        // 绘制发光粒子
        ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // 核心高亮
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  };

  // ============================================================================
  // 🔧 调试视图：可视化导线路径和连接关系
  // ============================================================================
  const renderDebugView = (circuitData, connectionGraph, blobs = null) => {
    if (!simCanvasRef.current || !imgRef.current) return;
    
    syncCanvasSize();
    
    const canvas = simCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 获取坐标转换比例
    const naturalW = imageNaturalSize.w || imgRef.current.naturalWidth;
    const naturalH = imageNaturalSize.h || imgRef.current.naturalHeight;
    const canvasW = imgRef.current.clientWidth;
    const canvasH = imgRef.current.clientHeight;
    const scaleX = canvasW / naturalW;
    const scaleY = canvasH / naturalH;
    
    console.log('[🔧 DebugView] 坐标转换比例:', {
      naturalSize: `${naturalW}x${naturalH}`,
      canvasSize: `${canvasW}x${canvasH}`,
      scale: `${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`
    });
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 0. 绘制 Blob 覆盖区域（半透明底层）
    if (blobs && blobs.length > 0) {
      console.log('[🔧 DebugView] 绘制 Blob 覆盖区域，数量:', blobs.length);
      
      blobs.forEach((blob, idx) => {
        // 为每个 Blob 分配不同的半透明颜色
        const hue = (idx * 60) % 360;
        ctx.fillStyle = `hsla(${hue}, 60%, 50%, 0.3)`;
        
        // 绘制 Blob 的所有像素
        blob.pixels.forEach(pixel => {
          const x = pixel.x * scaleX;
          const y = pixel.y * scaleY;
          ctx.fillRect(x, y, Math.max(1, scaleX), Math.max(1, scaleY));
        });
        
        // 在 Blob 的边界框中心标注编号
        const centerX = (blob.bbox.x + blob.bbox.width / 2) * scaleX;
        const centerY = (blob.bbox.y + blob.bbox.height / 2) * scaleY;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(`Blob${idx}`, centerX, centerY);
        ctx.fillText(`Blob${idx}`, centerX, centerY);
      });
      
      console.log('[🔧 DebugView] Blob 覆盖区域绘制完成');
    }
    
    // 1. 绘制元件轮廓（用不同颜色区分）
    console.log('[🔧 DebugView] 绘制元件轮廓，数量:', assignments.length);
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'];
    
    assignments.forEach((element, idx) => {
      if (!element.contour || element.contour.length === 0) return;
      
      const color = colors[idx % colors.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.fillStyle = color.replace(')', ', 0.2)').replace('rgb', 'rgba').replace('#', 'rgba(');
      
      // 绘制轮廓
      ctx.beginPath();
      const firstPoint = element.contour[0];
      ctx.moveTo(firstPoint.x * scaleX, firstPoint.y * scaleY);
      for (let i = 1; i < element.contour.length; i++) {
        const p = element.contour[i];
        ctx.lineTo(p.x * scaleX, p.y * scaleY);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      
      // 绘制元件中心点和编号
      let sumX = 0, sumY = 0;
      for (const p of element.contour) {
        sumX += p.x;
        sumY += p.y;
      }
      const centerX = (sumX / element.contour.length) * scaleX;
      const centerY = (sumY / element.contour.length) * scaleY;
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // 元件编号和类型
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(`${idx}`, centerX, centerY);
      ctx.fillText(`${idx}`, centerX, centerY);
      
      // 元件类型标签
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = '#000000';
      ctx.fillRect(centerX - 40, centerY + 15, 80, 20);
      ctx.fillStyle = color;
      ctx.fillText(element.element_type, centerX, centerY + 25);
    });
    
    // 2. 绘制连接图中的所有边（导线路径）
    if (connectionGraph && connectionGraph.edges) {
      console.log('[🔧 DebugView] 绘制导线路径，边数:', connectionGraph.edges.length);
      
      connectionGraph.edges.forEach((edge, edgeIdx) => {
        if (!edge.path || edge.path.length < 2) return;
        
        // 使用渐变颜色区分不同的边
        const hue = (edgeIdx * 137.5) % 360; // 黄金角度分布
        ctx.strokeStyle = `hsl(${hue}, 80%, 50%)`;
        ctx.lineWidth = 4;
        ctx.shadowColor = `hsl(${hue}, 80%, 50%)`;
        ctx.shadowBlur = 10;
        
        // 绘制路径
        ctx.beginPath();
        const firstPoint = edge.path[0];
        ctx.moveTo(firstPoint.x * scaleX, firstPoint.y * scaleY);
        
        for (let i = 1; i < edge.path.length; i++) {
          const p = edge.path[i];
          ctx.lineTo(p.x * scaleX, p.y * scaleY);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // 在路径中点绘制方向箭头
        if (edge.path.length >= 2) {
          const midIdx = Math.floor(edge.path.length / 2);
          const p1 = edge.path[midIdx - 1];
          const p2 = edge.path[midIdx];
          const x1 = p1.x * scaleX;
          const y1 = p1.y * scaleY;
          const x2 = p2.x * scaleX;
          const y2 = p2.y * scaleY;
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          
          // 绘制箭头
          ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.lineTo(
            midX - 10 * Math.cos(angle - Math.PI / 6),
            midY - 10 * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            midX - 10 * Math.cos(angle + Math.PI / 6),
            midY - 10 * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
        
        // 绘制起点和终点标记
        const startP = edge.path[0];
        const endP = edge.path[edge.path.length - 1];
        
        // 起点（空心圆）
        ctx.strokeStyle = `hsl(${hue}, 80%, 50%)`;
        ctx.fillStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(startP.x * scaleX, startP.y * scaleY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 终点（实心圆）
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        ctx.beginPath();
        ctx.arc(endP.x * scaleX, endP.y * scaleY, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    
    // 2.5. 绘制 Blob 与元件的接触点（诊断用）
    if (blobs && blobs.length > 0) {
      console.log('[🔧 DebugView] 检测并绘制 Blob-元件接触点...');
      const PROXIMITY_THRESHOLD = 4; // 和算法中的阈值保持一致
      
      blobs.forEach((blob, blobIdx) => {
        // 提取 Blob 边界像素
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
        
        // 检测与每个元件的接触点
        assignments.forEach((element, elemIdx) => {
          if (!element.contour || element.contour.length === 0) return;
          
          const contactPoints = [];
          
          for (const blobPixel of boundary) {
            for (const contourPoint of element.contour) {
              const dist = Math.hypot(blobPixel.x - contourPoint.x, blobPixel.y - contourPoint.y);
              if (dist <= PROXIMITY_THRESHOLD) {
                contactPoints.push({
                  blobPixel: { x: blobPixel.x, y: blobPixel.y },
                  contourPoint: { x: contourPoint.x, y: contourPoint.y },
                  distance: dist
                });
              }
            }
          }
          
          // 绘制接触点
          if (contactPoints.length > 0) {
            console.log(`[🔧 DebugView] Blob${blobIdx} 与元件${elemIdx} (${element.element_type}) 有 ${contactPoints.length} 个接触点`);
            
            // 使用黑色大圆点标识接触点
            ctx.fillStyle = '#000000';
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            
            contactPoints.forEach(cp => {
              const x = cp.blobPixel.x * scaleX;
              const y = cp.blobPixel.y * scaleY;
              
              // 绘制黑色大圆点
              ctx.beginPath();
              ctx.arc(x, y, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            });
          }
        });
      });
    }
    
    // 3. 左上角显示简单的调试标题
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, 10, 280, 50);
    
    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('🔧 调试模式 - 连接关系', 20, 35);
    
    if (circuitData && circuitData.branches) {
      console.log('[🔧 DebugView] 支路数量:', circuitData.branches.length);
     }
    
    // 4. 添加说明文字
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, canvas.height - 120, 500, 110);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('• 半透明色块 = Blob（连通域，算法识别的导线区域）', 20, canvas.height - 100);
    ctx.fillText('• 彩色轮廓 = 元件（编号显示在中心）', 20, canvas.height - 80);
    ctx.fillText('• 彩色线条 = 导线路径（箭头显示方向）', 20, canvas.height - 60);
    ctx.fillText('• 黑色大圆点 = Blob 与元件的接触点（距离≤4px）', 20, canvas.height - 40);
    ctx.fillText('• 空心圆 = 路径起点，实心圆 = 路径终点', 20, canvas.height - 20);
    
    console.log('[🔧 DebugView] 调试视图渲染完成');
  };

  // ============================================================================
  // 启动电流动画
  // ============================================================================
  const startCurrentAnimation = (circuitData) => {
    if (!simCanvasRef.current) return;
    
    // 同步画布尺寸
    syncCanvasSize();
    
    // 如果没有有效的支路数据，使用演示模式
    if (!circuitData.branches || circuitData.branches.length === 0) {
      console.log('[ElectricInputBox] 无有效支路，启动演示动画');
      startDemoAnimation();
      return;
    }
    
    // 🔧 关键修复：将导线路径坐标从图像原始坐标转换为画布显示坐标
    console.log('[ElectricInputBox] 转换导线路径坐标系统...');
    const naturalW = imageNaturalSize.w || imgRef.current.naturalWidth;
    const naturalH = imageNaturalSize.h || imgRef.current.naturalHeight;
    const canvasW = imgRef.current.clientWidth;
    const canvasH = imgRef.current.clientHeight;
    const scaleX = canvasW / naturalW;
    const scaleY = canvasH / naturalH;
    
    console.log('[ElectricInputBox] 坐标转换比例:', {
      naturalSize: `${naturalW}x${naturalH}`,
      canvasSize: `${canvasW}x${canvasH}`,
      scale: `${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`
    });
    
    // 转换所有支路的导线路径
    const transformedCircuitData = {
      ...circuitData,
      branches: circuitData.branches.map(branch => ({
        ...branch,
        wirePaths: branch.wirePaths.map(wirePath => 
          wirePath.map(point => ({
            x: point.x * scaleX,
            y: point.y * scaleY
          }))
        )
      }))
    };
    
    console.log('[ElectricInputBox] 坐标转换完成');
    console.log('[ElectricInputBox] 第一条支路第一个点:', 
      transformedCircuitData.branches[0]?.wirePaths[0]?.[0]);
    
    // 创建渲染器
    const renderer = createCurrentRenderer(simCanvasRef.current, {
      particleCount: 30,
      particleRadius: 4,
      glowRadius: 10,
      baseSpeed: 1.5
    });
    
    // 初始化并启动
    renderer.initialize(transformedCircuitData, assignments);
    renderer.start();
    
    rendererRef.current = renderer;
  };

  // ============================================================================
  // 弹窗拖拽
  // ============================================================================
  const handlePopupMouseDown = (e) => {
    e.stopPropagation();
    setIsDraggingPopup(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (isDraggingPopup) {
      const handleMove = (e) => {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;
        setPopupOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
        setDragStartPos({ x: e.clientX, y: e.clientY });
      };
      const handleUp = () => setIsDraggingPopup(false);
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isDraggingPopup, dragStartPos]);

  // ============================================================================
  // 渲染
  // ============================================================================
  return (
    <div style={{ position: 'relative' }}>
      <div className="status-line">
        {embedMs !== null && (
          <span style={{ marginLeft: 12 }}>{t('embeddingWarmup')}{embedMs} ms</span>
        )}
        {aiMs !== null && (
          <span style={{ marginLeft: 12 }}>{t('componentRecognition')}{aiMs} ms</span>
        )}
      </div>

      <div className="upload-area">
        <div
          className="upload-split-left"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          ref={uploadRef}
          onClick={!imagePreview ? handleClickUpload : undefined}
        >
          {imagePreview ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                ref={imgRef}
                src={imagePreview}
                alt="preview"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  borderRadius: 24,
                  pointerEvents: 'none',
                }}
                onLoad={handleImageLoad}
              />
              
              {/* SAM 分割画布 */}
              <canvas
                className="canvas-holder"
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  zIndex: 2,
                  cursor: isSegmentationDisabled ? 'not-allowed' : 'crosshair'
                }}
              />
              
              {/* 电流动画画布 */}
              <canvas
                ref={simCanvasRef}
                style={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  zIndex: 3,
                  pointerEvents: 'none'
                }}
              />

              {/* 元件选择弹窗 */}
              {lastImageContour.length > 0 && pendingElements.length > 0 && canvasRef.current && lastMousePos && (() => {
                const rect = canvasRef.current.getBoundingClientRect();
                const { x: mouseX, y: mouseY } = lastMousePos;
                
                const popupWidth = 180;
                const popupHeight = 28 + (pendingElements.length * 35) + 16;
                
                let leftPos = mouseX + 12;
                let topPos = mouseY;
                
                if (leftPos + popupWidth > rect.width - 10) {
                  leftPos = mouseX - popupWidth - 12;
                }
                if (topPos + popupHeight > rect.height - 10) {
                  topPos = mouseY - popupHeight;
                }
                
                leftPos = Math.max(10, Math.min(leftPos, rect.width - popupWidth - 10));
                topPos = Math.max(10, Math.min(topPos, rect.height - popupHeight - 10));

                return (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: rect.width,
                    height: rect.height,
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: leftPos + popupOffset.x,
                      top: topPos + popupOffset.y,
                      pointerEvents: 'auto',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: '8px 10px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      minWidth: 160,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}>
                      <div 
                        style={{ 
                          fontSize: 12, 
                          color: '#666', 
                          marginBottom: 4,
                          cursor: 'grab',
                          userSelect: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        onMouseDown={handlePopupMouseDown}
                      >
                        <span style={{ fontSize: 10, opacity: 0.5 }}>⋮⋮</span>
                        {t('selectComponent')}
                      </div>
                      {pendingElements.map((e, i) => (
                        <button
                          key={(e.name) + i}
                          className="start-btn"
                          style={{
                            textAlign: 'left',
                            padding: '6px 10px',
                            fontSize: 13,
                            backgroundColor: '#f8fafc',
                            width: '100%',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => assignCurrentSelection(e, i)}
                        >
                          {ELECTRIC_ELEMENTS[e.element_type]?.name || e.name}
                          {e.visual_description && (
                            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>
                              ({e.visual_description})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* 底部按钮 */}
              <div style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                zIndex: 30,
                pointerEvents: 'auto'
              }}>
                {/* 🔧 调试模式开关 */}
                <button 
                  className="start-btn" 
                  onClick={() => setDebugMode(!debugMode)}
                  disabled={loading || isSimulating}
                  style={{
                    backgroundColor: debugMode ? 'rgba(255, 150, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    color: debugMode ? '#fff' : '#333',
                    fontWeight: debugMode ? 'bold' : 'normal',
                    border: debugMode ? '2px solid #ff6600' : '1px solid #e5e7eb'
                  }}
                  title={t('debugMode')}
                >
                  {debugMode ? t('debugMode') : t('debug')}
                </button>
                
                <button 
                  className="start-btn" 
                  onClick={handleStartSimulate} 
                  disabled={loading}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                  }}
                >
                  {isSimulating ? t('reset') : t('startSimulation')}
                </button>
              </div>
            </div>
          ) : (
            <div className="upload-text">{t('uploadCircuitHint')}</div>
          )}
        </div>
        
        {/* 右侧参数面板 */}
        <div className="upload-split-right">
          <ElectricParametersPanel
            elements={assignments}
            onParametersChange={handleParametersChange}
            isSimulating={isSimulating}
          />
        </div>
      </div>

      {/* 信息区域 */}
      {(recognizedElements.length > 0 || assignments.length > 0) && (
        <div style={{ 
          marginTop: 12, 
          marginRight: 380,
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)',
          border: '1px solid #000000',
          borderRadius: 12,
          display: 'flex', 
          alignItems: 'center', 
          gap: 20,
          flexWrap: 'wrap'
        }}>
          {/* 识别到的元素 */}
          {recognizedElements.length > 0 && (
            <>
              <strong style={{ fontSize: 13, color: '#334' }}>{t('recognizedComponents')}</strong>
              {recognizedElements.map((elem, idx) => (
                <span
                  key={`${elem.name}-${idx}`}
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: 10,
                    backgroundColor: '#eef',
                    color: '#334',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                >
                  {ELECTRIC_ELEMENTS[elem.element_type]?.name || elem.name}
                </span>
              ))}
            </>
          )}

          {/* 分隔符 */}
          {recognizedElements.length > 0 && assignments.length > 0 && (
            <span style={{ color: '#d1d5db', fontSize: 16, fontWeight: 300 }}>|</span>
          )}

          {/* 已分配的元素 */}
          {assignments.length > 0 && (
            <>
              <strong style={{ fontSize: 13, color: '#334' }}>{t('selected')}</strong>
              {assignments.map((a, i) => (
                <span
                  key={a.label + i}
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: 10,
                    background: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                >
                  {a.label}
                </span>
              ))}
              <span style={{ color: '#6b7280', fontSize: 12 }}>
                {t('complete')} {assignments.length}/{recognizedElements.length}
              </span>
            </>
          )}
        </div>
      )}

      {loading && <LoadingSpinner text={t('processing')} />}
      <ErrorToast message={error} />
    </div>
  );
});

export default ElectricInputBox;
