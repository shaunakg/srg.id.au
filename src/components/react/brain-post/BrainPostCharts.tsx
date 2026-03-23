import { useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './BrainPostCharts.scss';
import type { CorticalRegionDatum, RuntimeStageDatum, SingleValueDatum } from '../../../data/posts/brain/charts';

interface ChartFrameProps {
  title: string;
  controls?: ReactNode;
  children: ReactNode;
}

function ChartFrame({ title, controls, children }: ChartFrameProps) {
  return (
    <figure className="brain-post-chart">
      <div className="brain-post-chart__header">
        <h3>{title}</h3>
        {controls ? <div className="brain-post-chart__controls">{controls}</div> : null}
      </div>
      <div className="brain-post-chart__surface">{children}</div>
    </figure>
  );
}

function ChartButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`brain-post-chart__button${active ? ' is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function formatMm3(value: number) {
  return `${Math.round(value).toLocaleString()} mm³`;
}

function formatCm3(value: number) {
  return `${(value / 1000).toFixed(1)} cm³`;
}

function formatIn3(value: number) {
  return `${(value / 16387.064).toFixed(2)} in³`;
}

function formatMm2(value: number) {
  return `${Math.round(value).toLocaleString()} mm²`;
}

function roundedRightRectPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return [
    `M ${x} ${y}`,
    `H ${x + width - r}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
    `H ${x}`,
    'Z',
  ].join(' ');
}

function RuntimeTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RuntimeStageDatum }> }) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="brain-post-chart__tooltip">
      <strong>{datum.label}</strong>
      <div>{datum.durationMinutes.toFixed(1)} min</div>
      <div>Started at {datum.startHours.toFixed(2)} h</div>
      {datum.note ? <div>{datum.note}</div> : null}
    </div>
  );
}

function CompartmentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SingleValueDatum }> }) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="brain-post-chart__tooltip">
      <strong>{datum.label}</strong>
      <div>{formatMm3(datum.valueMm3)}</div>
      <div>{formatCm3(datum.valueMm3)}</div>
      <div>{formatIn3(datum.valueMm3)}</div>
    </div>
  );
}

function CorticalTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: CorticalRegionDatum & Record<string, number> }>;
  metric: 'volume' | 'area' | 'thickness';
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <div className="brain-post-chart__tooltip">
      <strong>{datum.label}</strong>
      {metric === 'volume' ? (
        <>
          <div>Left: {formatCm3(datum.leftGrayMm3)}</div>
          <div>Right: {formatCm3(datum.rightGrayMm3)}</div>
          <div>Total: {formatCm3(datum.totalGrayMm3)}</div>
        </>
      ) : null}
      {metric === 'area' ? (
        <>
          <div>Left: {formatMm2(datum.leftAreaMm2)}</div>
          <div>Right: {formatMm2(datum.rightAreaMm2)}</div>
          <div>Total: {formatMm2(datum.totalAreaMm2)}</div>
        </>
      ) : null}
      {metric === 'thickness' ? (
        <>
          <div>Left: {datum.leftThicknessMm.toFixed(2)} mm</div>
          <div>Right: {datum.rightThicknessMm.toFixed(2)} mm</div>
          <div>Mean: {datum.meanThicknessMm.toFixed(2)} mm</div>
        </>
      ) : null}
    </div>
  );
}

export function FreeSurferRuntimeChart({
  items,
}: {
  items: RuntimeStageDatum[];
}) {
  const [sortMode, setSortMode] = useState<'duration' | 'start'>('start');

  const data = useMemo(() => {
    const next = [...items];
    next.sort((a, b) => {
      if (sortMode === 'duration') return b.durationMinutes - a.durationMinutes;
      return a.startHours - b.startHours;
    });
    return next;
  }, [items, sortMode]);

  return (
    <ChartFrame
      title="What did FreeSurfer spend its time on?"
      controls={
        <>
          <ChartButton active={sortMode === 'duration'} onClick={() => setSortMode('duration')}>
            Sort by duration
          </ChartButton>
          <ChartButton active={sortMode === 'start'} onClick={() => setSortMode('start')}>
            Sort by run order
          </ChartButton>
        </>
      }
    >
      <div className="brain-post-chart__canvas brain-post-chart__canvas--runtime">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 22, bottom: 8, left: 18 }}>
            <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="rgba(85,96,85,0.14)" />
            <XAxis
              type="number"
              tick={{ fill: 'rgba(10,10,10,0.56)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              unit=" min"
            />
            <YAxis
              type="category"
              dataKey="label"
              width={168}
              tick={{ fill: '#0a0a0a', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'rgba(85,96,85,0.06)' }} content={<RuntimeTooltip />} />
            <Bar dataKey="durationMinutes" radius={[0, 999, 999, 0]} fill="#8e6db0">
              <LabelList
                dataKey="durationMinutes"
                position="right"
                formatter={(value) => (typeof value === 'number' ? value.toFixed(1) : String(value ?? ''))}
                className="brain-post-chart__recharts-label"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function BrainCompartmentChart({ items }: { items: SingleValueDatum[] }) {
  const [unit, setUnit] = useState<'cm3' | 'in3'>('cm3');
  const data = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        displayValue: unit === 'cm3' ? Number((item.valueMm3 / 1000).toFixed(1)) : Number((item.valueMm3 / 16387.064).toFixed(2)),
      })),
    [items, unit],
  );

  return (
    <ChartFrame
      title="How much of my brain is cortex, white matter and everything else?"
      controls={
        <>
          <ChartButton active={unit === 'cm3'} onClick={() => setUnit('cm3')}>
            cm³
          </ChartButton>
          <ChartButton active={unit === 'in3'} onClick={() => setUnit('in3')}>
            in³
          </ChartButton>
        </>
      }
    >
      <div className="brain-post-chart__canvas brain-post-chart__canvas--compartments">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 26, bottom: 8, left: 24 }}>
            <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="rgba(85,96,85,0.14)" />
            <XAxis
              type="number"
              tick={{ fill: 'rgba(10,10,10,0.56)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              unit={unit === 'cm3' ? ' cm³' : ' in³'}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={190}
              tick={{ fill: '#0a0a0a', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'rgba(85,96,85,0.06)' }} content={<CompartmentTooltip />} />
            <Bar
              dataKey="displayValue"
              radius={[0, 999, 999, 0]}
              shape={(props: any) => {
                const { fill, x, y, width, height, payload } = props;
                return <path d={roundedRightRectPath(x, y, width, height, height / 2)} fill={payload.color ?? fill} />;
              }}
            >
              <LabelList
                dataKey="displayValue"
                position="right"
                formatter={(value) => (typeof value === 'number' ? value.toLocaleString() : String(value ?? ''))}
                className="brain-post-chart__recharts-label"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function FreeSurferCorticalRegionsChart({ items }: { items: CorticalRegionDatum[] }) {
  const [metric, setMetric] = useState<'volume' | 'area' | 'thickness'>('volume');

  const data = useMemo(() => {
    const next = [...items];
    next.sort((a, b) => {
      if (metric === 'volume') return b.totalGrayMm3 - a.totalGrayMm3;
      if (metric === 'area') return b.totalAreaMm2 - a.totalAreaMm2;
      return b.meanThicknessMm - a.meanThicknessMm;
    });
    return next.slice(0, 10).map((item) => ({
      ...item,
      leftDisplay: metric === 'volume' ? Number((item.leftGrayMm3 / 1000).toFixed(2)) : metric === 'area' ? Math.round(item.leftAreaMm2) : Number(item.leftThicknessMm.toFixed(2)),
      rightDisplay: metric === 'volume' ? Number((item.rightGrayMm3 / 1000).toFixed(2)) : metric === 'area' ? Math.round(item.rightAreaMm2) : Number(item.rightThicknessMm.toFixed(2)),
    }));
  }, [items, metric]);

  const unit = metric === 'volume' ? ' cm³' : metric === 'area' ? ' mm²' : ' mm';

  return (
    <ChartFrame
      title="Which named cortical regions took up the most space?"
      controls={
        <>
          <ChartButton active={metric === 'volume'} onClick={() => setMetric('volume')}>
            Gray volume
          </ChartButton>
          <ChartButton active={metric === 'area'} onClick={() => setMetric('area')}>
            Surface area
          </ChartButton>
          <ChartButton active={metric === 'thickness'} onClick={() => setMetric('thickness')}>
            Thickness
          </ChartButton>
        </>
      }
    >
      <div className="brain-post-chart__canvas brain-post-chart__canvas--cortical">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 18 }} barGap={2}>
            <CartesianGrid strokeDasharray="2 6" horizontal={false} stroke="rgba(85,96,85,0.14)" />
            <XAxis
              type="number"
              tick={{ fill: 'rgba(10,10,10,0.56)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              unit={unit}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={168}
              tick={{ fill: '#0a0a0a', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'rgba(85,96,85,0.06)' }} content={<CorticalTooltip metric={metric} />} />
            <Legend wrapperStyle={{ color: 'rgba(10,10,10,0.72)', fontSize: 12, paddingTop: 6 }} />
            <Bar dataKey="leftDisplay" name="Left hemisphere" fill="#8e6db0" radius={[0, 999, 999, 0]} />
            <Bar dataKey="rightDisplay" name="Right hemisphere" fill="#cf6e5f" radius={[0, 999, 999, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
