import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OrgNode } from '@/components/admin/OrgNode';
import { OrgGraphDetailsPanel } from '@/components/admin/OrgGraphDetailsPanel';
import toast from 'react-hot-toast';

const nodeTypes = {
  orgNode: OrgNode,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 100 });

  nodes.forEach((node: any) => {
    dagreGraph.setNode(node.id, { width: 220, height: 120 });
  });

  edges.forEach((edge: any) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node: any) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 110,
        y: nodeWithPosition.y - 60,
      },
    };
  });

  return { nodes: newNodes, edges };
};

export default function OrgGraph() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodes, setNodes, onNodesChange] = useNodesState([] as any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as any[]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch users
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('user_id, name, role, department, manager_id');
      if (usersErr) throw usersErr;

      // Fetch active goals count
      const { data: goals, error: goalsErr } = await supabase
        .from('goals')
        .select('owner_id, status')
        .neq('status', 'draft');
      if (goalsErr) throw goalsErr;

      // Fetch escalations count
      const { data: escalations, error: escErr } = await supabase
        .from('escalation_logs')
        .select('user_id, escalation_type');
      if (escErr) throw escErr;

      const initialNodes: any[] = [];
      const initialEdges: any[] = [];

      users?.forEach((user: any) => {
        const userGoals = goals?.filter((g: any) => g.owner_id === user.user_id) || [];
        const userEscalations = escalations?.filter((e: any) => e.user_id === user.user_id) || [];

        initialNodes.push({
          id: user.user_id,
          type: 'orgNode',
          position: { x: 0, y: 0 },
          data: {
            name: user.name,
            role: user.role,
            department: user.department,
            activeGoals: userGoals.length,
            activeEscalations: userEscalations.length,
            isSelected: false,
          },
        });

        if (user.manager_id) {
          initialEdges.push({
            id: `e-${user.manager_id}-${user.user_id}`,
            source: user.manager_id,
            target: user.user_id,
            type: 'smoothstep',
            animated: userEscalations.length > 0,
            style: { 
              stroke: userEscalations.length > 0 ? '#ef4444' : '#525252',
              strokeWidth: userEscalations.length > 0 ? 2 : 1 
            },
          });
        }
      });

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges
      );

      setNodes(layoutedNodes as any);
      setEdges(layoutedEdges as any);
    } catch (err: any) {
      toast.error('Failed to load org graph: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const onConnect = useCallback((params: any) => setEdges((eds: any) => addEdge(params, eds) as any), [setEdges]);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedUserId(node.id);
    
    // Highlight the selected node visually
    setNodes((nds: any) => 
      nds.map((n: any) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: n.id === node.id
        }
      }))
    );
  }, [setNodes]);

  const handleClosePanel = useCallback(() => {
    setSelectedUserId(null);
    setNodes((nds: any) => 
      nds.map((n: any) => ({ ...n, data: { ...n.data, isSelected: false } }))
    );
  }, [setNodes]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/50 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-white">Organization Graph</h1>
          <p className="text-sm text-neutral-400">Live view of reporting lines, active goals, and escalations.</p>
        </div>
        <button
          onClick={fetchGraphData}
          className="flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="relative flex-1 bg-[#0a0d14]">
        {loading && nodes.length === 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0d14]/80 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-[#fdb913]" />
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[#0a0d14]"
            minZoom={0.2}
            maxZoom={1.5}
          >
            <Controls className="bg-neutral-900 border-neutral-800 fill-white" />
            <MiniMap 
              nodeColor={(n: any) => n.data?.isSelected ? '#fdb913' : (Number(n.data?.activeEscalations) > 0 ? '#ef4444' : '#262626')}
              maskColor="rgba(10, 13, 20, 0.7)"
              className="bg-neutral-900 border-neutral-800"
            />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#262626" />
          </ReactFlow>
        )}

        {/* Slide-out details panel */}
        {selectedUserId && (
          <OrgGraphDetailsPanel 
            userId={selectedUserId} 
            onClose={handleClosePanel} 
          />
        )}
      </div>
    </div>
  );
}
