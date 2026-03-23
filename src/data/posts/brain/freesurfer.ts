import summary from './freesurfer-post.json';

export interface FreeSurferCorticalRegionDatum {
  label: string;
  leftGrayMm3: number;
  rightGrayMm3: number;
  totalGrayMm3: number;
  leftAreaMm2: number;
  rightAreaMm2: number;
  totalAreaMm2: number;
  leftThicknessMm: number;
  rightThicknessMm: number;
  meanThicknessMm: number;
}

const prettifyRegionLabel = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(^|\s)([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
    .replace(/Diencephalon/g, 'Diencephalon');

export const freesurferCorticalRegions: FreeSurferCorticalRegionDatum[] = (summary.topCorticalRegions as Array<any>).map((item) => ({
  ...item,
  label: prettifyRegionLabel(item.label),
}));

export const freesurferHemisphereMetrics = summary.hemisphereMetrics as {
  leftSurfaceAreaMm2: number;
  rightSurfaceAreaMm2: number;
  leftMeanThicknessMm: number;
  rightMeanThicknessMm: number;
};
