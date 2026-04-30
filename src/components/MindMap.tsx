"use client";

import { useEffect, useRef } from "react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";

type Props = { markdown: string };

const transformer = new Transformer();

export default function MindMap({ markdown }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const { root } = transformer.transform(markdown);
    if (!mmRef.current) {
      mmRef.current = Markmap.create(svgRef.current, undefined, root);
    } else {
      mmRef.current.setData(root);
      mmRef.current.fit();
    }
  }, [markdown]);

  return (
    <div className="mindmap-container w-full rounded-lg bg-white border border-slate-200 p-2">
      <svg ref={svgRef} />
      <div className="flex justify-center gap-2 pt-3 pb-1">
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => mmRef.current?.fit()}
        >
          Fit to screen
        </button>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => mmRef.current?.rescale(1.25)}
        >
          Zoom in
        </button>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => mmRef.current?.rescale(0.8)}
        >
          Zoom out
        </button>
      </div>
    </div>
  );
}
