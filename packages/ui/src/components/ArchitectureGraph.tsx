import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
  BackgroundVariant,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ShieldAlert, CheckCircle2, Box } from "lucide-react";
import type { ManifestData, DiagnosticsData } from "../api.js";

interface ArchitectureGraphProps {
  manifestData: ManifestData;
  diagnosticsData: DiagnosticsData | null;
}

// カスタムノードコンポーネント
function CustomModuleNode({ data }: { data: any }) {
  const isViolated = data.violationCount > 0;

  return (
    <div
      className={`card card-compact w-64 bg-base-100 border shadow-lg transition-all hover:scale-105 ${
        isViolated ? "border-error shadow-error/20" : "border-base-300 hover:border-primary"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      
      <div className="card-body p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-sm truncate">
            <Box size={16} className={isViolated ? "text-error" : "text-primary"} />
            <span className="truncate">{data.label}</span>
          </div>
          {isViolated ? (
            <span className="badge badge-error badge-sm gap-1 font-mono text-[10px]">
              <ShieldAlert size={10} /> {data.violationCount}
            </span>
          ) : (
            <span className="badge badge-success badge-sm gap-1 font-mono text-[10px]">
              <CheckCircle2 size={10} /> 0
            </span>
          )}
        </div>

        <code className="text-[11px] font-mono bg-base-200 px-2 py-0.5 rounded text-base-content/80 truncate">
          {data.path}
        </code>

        {data.description && (
          <p className="text-[11px] text-base-content/60 line-clamp-1 mt-0.5">{data.description}</p>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-base-200 text-[10px] text-base-content/70">
          <span>Allowed: {data.allowedCount}</span>
          <span className={data.forbiddenCount > 0 ? "text-error font-medium" : ""}>
            Forbidden: {data.forbiddenCount}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

const nodeTypes = {
  moduleNode: CustomModuleNode,
};

export const ArchitectureGraph: React.FC<ArchitectureGraphProps> = ({
  manifestData,
  diagnosticsData,
}) => {
  const structure = manifestData.manifest.structure;

  const { nodes, edges } = useMemo(() => {
    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // モジュール名・パスのマッピング辞書
    const moduleMap = new Map<string, string>();
    structure.forEach((rule) => {
      const id = rule.name || rule.path;
      moduleMap.set(id.toLowerCase(), id);
      moduleMap.set(rule.path.toLowerCase(), id);
      if (rule.name) moduleMap.set(rule.name.toLowerCase(), id);
    });

    // レイヤー配置計算（階層的に配置）
    const columnWidth = 320;
    const rowHeight = 160;
    const itemsPerRow = Math.max(2, Math.ceil(Math.sqrt(structure.length)));

    structure.forEach((rule, idx) => {
      const id = rule.name || rule.path;
      const violations =
        diagnosticsData?.diagnostics.filter(
          (d) => d.ruleName === rule.name || d.ruleName === rule.path || d.filePath.includes(rule.path)
        ) || [];

      const col = idx % itemsPerRow;
      const row = Math.floor(idx / itemsPerRow);

      generatedNodes.push({
        id,
        type: "moduleNode",
        position: { x: col * columnWidth + 40, y: row * rowHeight + 40 },
        data: {
          label: rule.name || rule.path,
          path: rule.path,
          description: rule.description,
          violationCount: violations.length,
          allowedCount: rule.allowed_imports.length,
          forbiddenCount: rule.forbidden_imports.length,
        },
      });

      // 許可されたインポートのエッジ
      rule.allowed_imports.forEach((targetPattern, targetIdx) => {
        // 対象モジュールを探す
        const targetRule = structure.find((other) => {
          if (other === rule) return false;
          const otherId = other.name || other.path;
          return (
            targetPattern.includes(other.path) ||
            targetPattern.includes(other.name || "") ||
            other.path.includes(targetPattern.replace(/\/\*\*|\/\*/g, ""))
          );
        });

        if (targetRule) {
          const targetId = targetRule.name || targetRule.path;
          generatedEdges.push({
            id: `edge-allowed-${id}-${targetId}-${targetIdx}`,
            source: id,
            target: targetId,
            animated: true,
            style: { stroke: "#38bdf8", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#38bdf8",
              width: 16,
              height: 16,
            },
          });
        }
      });

      // アーキテクチャ違反のエッジ（診断結果から生成）
      violations.forEach((v, vIdx) => {
        if (v.forbiddenTarget) {
          const targetRule = structure.find(
            (other) =>
              other.path.includes(v.forbiddenTarget!) ||
              (other.name && v.forbiddenTarget!.includes(other.name))
          );
          if (targetRule) {
            const targetId = targetRule.name || targetRule.path;
            generatedEdges.push({
              id: `edge-violation-${id}-${targetId}-${vIdx}`,
              source: id,
              target: targetId,
              animated: true,
              style: { stroke: "#ef4444", strokeWidth: 3, strokeDasharray: "5 5" },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "#ef4444",
                width: 18,
                height: 18,
              },
            });
          }
        }
      });
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [structure, diagnosticsData]);

  return (
    <div className="w-full h-[520px] rounded-box border border-base-300 bg-base-200/50 overflow-hidden relative shadow-inner">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        className="daisy-flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="rgba(148, 163, 184, 0.2)" />
        <Controls className="!bg-base-100 !border-base-300 !text-base-content !rounded-box shadow-md" />
        <MiniMap
          nodeColor={(n) => ((n.data?.violationCount as number) > 0 ? "#ef4444" : "#38bdf8")}
          className="!bg-base-100/90 !border-base-300 !rounded-box shadow-md"
        />
      </ReactFlow>

      {/* グラフ上オーバーレイの凡例（Fomantic / DaisyUI Badge） */}
      <div className="absolute top-3 left-3 bg-base-100/90 backdrop-blur-sm px-3 py-2 rounded-box border border-base-300 shadow-md flex items-center gap-4 text-xs font-medium z-10">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-info inline-block" />
          <span>Allowed Import</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-error border-b border-dashed border-error inline-block" />
          <span className="text-error font-semibold">Violation</span>
        </div>
      </div>
    </div>
  );
};
