import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

export const DEVICE_TYPES = [
  { value: 'laser_system', label: 'Lasersystem', short: 'LS', color: 'bg-red-100 text-red-700' },
  { value: 'camera', label: 'Kamera', short: 'KA', color: 'bg-blue-100 text-blue-700' },
  { value: 'confocal', label: 'Confocal', short: 'CF', color: 'bg-purple-100 text-purple-700' },
  { value: 'microscope', label: 'Mikroskop', short: 'MI', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'illumination', label: 'Beleuchtungsgerät', short: 'BE', color: 'bg-amber-100 text-amber-700' },
  { value: 'scanning_stage', label: 'Scanningtisch', short: 'ST', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'incubation_chamber', label: 'Inkubationskammer', short: 'IK', color: 'bg-pink-100 text-pink-700' },
  { value: 'virtex', label: 'ViRTEx', short: 'VX', color: 'bg-teal-100 text-teal-700' },
  { value: 'pc', label: 'PC', short: 'PC', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'custom', label: 'Benutzerdefiniert', short: 'CU', color: 'bg-gray-100 text-gray-700' },
];

export const STATUS_STYLES = {
  active: { border: 'border-green-500', ring: 'ring-green-200', label: 'Aktiv', dot: 'bg-green-500' },
  defect: { border: 'border-red-500', ring: 'ring-red-200', label: 'Defekt', dot: 'bg-red-500' },
  loaned: { border: 'border-amber-500', ring: 'ring-amber-200', label: 'Verliehen', dot: 'bg-amber-500' },
  removed: { border: 'border-gray-400', ring: 'ring-gray-200', label: 'Abgebaut', dot: 'bg-gray-400' },
};

// Gesamt-Status des Demo-Systems (5 Zustände)
export const SYSTEM_STATUS_STYLES = {
  active: { border: 'border-green-500', label: 'Aktiv', dot: 'bg-green-500', badge: 'bg-green-100 text-green-800' },
  defect: { border: 'border-red-500', label: 'Defekt', dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
  loaned: { border: 'border-amber-500', label: 'Verliehen', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
  demo_away: { border: 'border-blue-500', label: 'Demo außer Haus', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800' },
  fair: { border: 'border-purple-500', label: 'Auf Messe', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-800' },
};

const SIDE_TO_POSITION = {
  north: Position.Top,
  east: Position.Right,
  south: Position.Bottom,
  west: Position.Left,
};

const deviceTypeInfo = (type) =>
  DEVICE_TYPES.find((t) => t.value === type) || DEVICE_TYPES.find((t) => t.value === 'custom');

// ---------------------------------------------------------------------------
// Custom Node: Gerät = Quadrat mit 4 Andockpunkten, Rahmenfarbe = Status
// ---------------------------------------------------------------------------

const DemoDeviceNode = ({ data }) => {
  const info = deviceTypeInfo(data.device_type);
  const statusStyle = STATUS_STYLES[data.status] || STATUS_STYLES.active;
  const compCount = data.component_count || 0;

  return (
    <div
      className={`relative w-32 h-32 rounded-lg border-4 ${statusStyle.border} bg-white shadow-md flex flex-col items-center justify-center select-none`}
      title={`${info.label}: ${data.name}`}
    >
      {/* 4 Andockpunkte */}
      <Handle type="source" position={SIDE_TO_POSITION.north} id="north" className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white" />
      <Handle type="source" position={SIDE_TO_POSITION.east} id="east" className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white" />
      <Handle type="source" position={SIDE_TO_POSITION.south} id="south" className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white" />
      <Handle type="source" position={SIDE_TO_POSITION.west} id="west" className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white" />
      {/* Target-Handles an identischer Position (React Flow braucht target zum Verbinden) */}
      <Handle type="target" position={SIDE_TO_POSITION.north} id="north" className="!w-3 !h-3 !opacity-0 !pointer-events-none" />
      <Handle type="target" position={SIDE_TO_POSITION.east} id="east" className="!w-3 !h-3 !opacity-0 !pointer-events-none" />
      <Handle type="target" position={SIDE_TO_POSITION.south} id="south" className="!w-3 !h-3 !opacity-0 !pointer-events-none" />
      <Handle type="target" position={SIDE_TO_POSITION.west} id="west" className="!w-3 !h-3 !opacity-0 !pointer-events-none" />

      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${info.color}`}>{info.short}</span>
      <span className="mt-1 px-1 text-[11px] font-medium text-gray-800 text-center leading-tight line-clamp-2">
        {data.name}
      </span>
      {compCount > 0 && (
        <span className="absolute bottom-1 right-1 text-[9px] text-gray-400">{compCount} Komp.</span>
      )}
      <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ${statusStyle.dot}`} />
    </div>
  );
};

const nodeTypes = { demoDevice: DemoDeviceNode };

// ---------------------------------------------------------------------------
// Kontextmenü (Rechtsklick auf Gerät)
// ---------------------------------------------------------------------------

const ContextMenu = ({ x, y, device, onSetStatus, onDelete, onEdit, onClose }) => {
  if (!device) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-52"
        style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 220) }}
      >
        <button
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => { onEdit(device); onClose(); }}
        >
          Komponenten bearbeiten
        </button>
        <div className="border-t my-1" />
        <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase">Status setzen</div>
        {Object.entries(STATUS_STYLES).map(([key, val]) => (
          <button
            key={key}
            className={`w-full text-left px-4 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2 ${device.status === key ? 'font-semibold' : 'text-gray-700'}`}
            onClick={() => { onSetStatus(device, key); onClose(); }}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${val.dot}`} />
            {val.label}
            {device.status === key && <span className="ml-auto text-xs text-gray-400">aktiv</span>}
          </button>
        ))}
        <div className="border-t my-1" />
        <button
          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          onClick={() => { onDelete(device); onClose(); }}
        >
          Gerät löschen
        </button>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Diagramm-Komponente
// ---------------------------------------------------------------------------

const DiagramInner = ({
  devices,
  connections,
  onDeviceMove,
  onDeviceCreate,
  onDeviceEdit,
  onDeviceDelete,
  onDeviceStatus,
  onConnectionCreate,
  onConnectionDelete,
  readOnly = false,
}) => {
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Nodes aus Geräten aufbauen
  const initialNodes = useMemo(
    () =>
      devices.map((d) => ({
        id: String(d.id),
        type: 'demoDevice',
        position: { x: d.position_x || 0, y: d.position_y || 0 },
        data: {
          name: d.name,
          device_type: d.device_type,
          status: d.status,
          component_count: (d.components || []).length,
          deviceId: d.id,
        },
      })),
    [devices]
  );

  // Edges aus Verbindungen aufbauen
  const initialEdges = useMemo(
    () =>
      connections.map((c) => ({
        id: String(c.id),
        source: String(c.from_device),
        target: String(c.to_device),
        sourceHandle: c.from_side,
        targetHandle: c.to_side,
        animated: false,
        style: { stroke: '#64748b', strokeWidth: 2 },
      })),
    [connections]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync bei Datenänderungen von außen
  React.useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  React.useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  const onConnect = useCallback(
    (params) => {
      if (readOnly) return;
      if (!params.source || !params.target || params.source === params.target) return;
      onConnectionCreate({
        from_device: Number(params.source),
        from_side: params.sourceHandle || 'south',
        to_device: Number(params.target),
        to_side: params.targetHandle || 'north',
      });
    },
    [onConnectionCreate, readOnly]
  );

  const onNodeDragStop = useCallback(
    (event, node) => {
      if (readOnly) return;
      onDeviceMove(Number(node.id), node.position.x, node.position.y);
    },
    [onDeviceMove, readOnly]
  );

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      const device = devices.find((d) => String(d.id) === String(node.id));
      if (!device) return;
      setContextMenu({ x: event.clientX, y: event.clientY, device });
    },
    [devices]
  );

  const onNodeClick = useCallback(
    (event, node) => {
      const device = devices.find((d) => String(d.id) === String(node.id));
      if (device) onDeviceEdit(device);
    },
    [devices, onDeviceEdit]
  );

  const onEdgeContextMenu = useCallback(
    (event, edge) => {
      event.preventDefault();
      if (readOnly) return;
      if (window.confirm('Verbindung trennen?')) {
        onConnectionDelete(Number(edge.id));
      }
    },
    [onConnectionDelete, readOnly]
  );

  // Drag & Drop aus der Palette
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (readOnly) return;
      const type = event.dataTransfer.getData('application/demo-device-type');
      if (!type || !reactFlowInstance) return;
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onDeviceCreate(type, position.x, position.y);
    },
    [reactFlowInstance, onDeviceCreate, readOnly]
  );

  return (
    <div className="flex h-[600px] gap-4">
      {/* Palette */}
      {!readOnly && (
        <div className="w-48 shrink-0 bg-white rounded-lg shadow p-3 overflow-y-auto">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Geräte (ziehen)</h4>
          <div className="space-y-1.5">
            {DEVICE_TYPES.map((t) => (
              <div
                key={t.value}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/demo-device-type', t.value);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border border-gray-200 cursor-grab hover:shadow text-sm ${t.color}`}
              >
                <span className="text-[10px] font-bold w-6 text-center">{t.short}</span>
                <span className="text-gray-700">{t.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-gray-400 leading-tight">
            Gerät an einen Andockpunkt ziehen zum Verbinden. Rechtsklick für Status/Löschen.
          </p>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 rounded-lg shadow overflow-hidden" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Controls />
          <MiniMap zoomable pannable />
          <Background gap={16} />
        </ReactFlow>
      </div>

      <ContextMenu
        x={contextMenu?.x}
        y={contextMenu?.y}
        device={contextMenu?.device}
        onEdit={onDeviceEdit}
        onSetStatus={onDeviceStatus}
        onDelete={onDeviceDelete}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
};

const DemoSetupDiagram = (props) => (
  <ReactFlowProvider>
    <DiagramInner {...props} />
  </ReactFlowProvider>
);

export default DemoSetupDiagram;