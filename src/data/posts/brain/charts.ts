import {
  freesurferCorticalRegions,
  type FreeSurferCorticalRegionDatum,
} from './freesurfer';

export interface RuntimeStageDatum {
  label: string;
  rawLabel: string;
  durationMinutes: number;
  startHours: number;
  note?: string;
}

export interface SingleValueDatum {
  label: string;
  valueMm3: number;
  color: string;
}

export interface CorticalRegionDatum extends FreeSurferCorticalRegionDatum {}

export const freesurferRuntimeHours = 3.78;

export const freesurferRuntimeStages: RuntimeStageDatum[] = [
  {
    label: 'CA register',
    rawLabel: 'CA Reg',
    durationMinutes: 87.0,
    startHours: 0.401,
    note: 'Aligns the brain to FreeSurfer’s atlas using nonlinear registration. This helps later steps use a standard anatomical reference.',
  },
  {
    label: 'Subcortical segmentation',
    rawLabel: 'SubCort Seg',
    durationMinutes: 29.8,
    startHours: 1.852,
    note: 'Labels deep brain structures in the volume. Examples include the thalamus, hippocampus, and basal ganglia.',
  },
  {
    label: 'Cortical parcellation (RH)',
    rawLabel: 'Cortical Parc rh',
    durationMinutes: 14.3,
    startHours: 3.165,
    note: 'Assigns anatomical labels to regions on the right cortical surface. These labels follow major gyri and sulci.',
  },
  {
    label: 'Topology fixing (RH)',
    rawLabel: 'Fix Topology rh',
    durationMinutes: 11.6,
    startHours: 2.526,
    note: 'Repairs errors in the right hemisphere surface mesh. The goal is to make the surface anatomically valid and continuous.',
  },
  {
    label: 'Skull stripping',
    rawLabel: 'Skull Stripping',
    durationMinutes: 9.3,
    startHours: 0.105,
    note: 'Removes the skull and other non-brain tissue from the scan. This isolates the brain for later processing.',
  },
  {
    label: 'Spherical mapping (LH)',
    rawLabel: 'Sphere lh',
    durationMinutes: 7.8,
    startHours: 2.753,
    note: 'Transforms the left cortical surface into a sphere-like shape. This makes it easier to compare across brains.',
  },
  {
    label: 'Expectation-Maximization registration',
    rawLabel: 'EM Registration',
    durationMinutes: 7.6,
    startHours: 0.26,
    note: 'Performs an initial alignment of the scan to the atlas. This gives later segmentation steps a starting reference.',
  },
  {
    label: 'Spherical mapping (RH)',
    rawLabel: 'Sphere rh',
    durationMinutes: 7.5,
    startHours: 2.882,
    note: 'Transforms the right cortical surface into a sphere-like shape. This supports cross-subject surface alignment.',
  },
  {
    label: 'Surface registration (LH)',
    rawLabel: 'Surf Reg lh',
    durationMinutes: 5.2,
    startHours: 3.007,
    note: 'Aligns the left hemisphere surface to a standard spherical atlas. This allows consistent regional comparison across subjects.',
  },
  {
    label: 'White-matter parcellation',
    rawLabel: 'WMParc',
    durationMinutes: 4.7,
    startHours: 3.581,
    note: 'Labels white-matter regions using the cortical and subcortical results. It extends anatomical labeling into volume space.',
  },
  {
    label: 'Surface registration (RH)',
    rawLabel: 'Surf Reg rh',
    durationMinutes: 4.1,
    startHours: 3.093,
    note: 'Aligns the right hemisphere surface to a standard spherical atlas. This allows consistent regional comparison across subjects.',
  },
  {
    label: 'Cortical ribbon mask',
    rawLabel: 'Cortical ribbon mask',
    durationMinutes: 3.4,
    startHours: 3.42,
    note: 'Builds a mask for the cortical gray matter ribbon. It uses the white and pial surfaces to define cortical thickness boundaries.',
  },
];

export const brainCompartmentVolumes: SingleValueDatum[] = [
  {
    label: 'Cortical grey matter',
    valueMm3: 520782.8983104129,
    color: '#c66a73',
  },
  {
    label: 'Cerebral white matter',
    valueMm3: 415911,
    color: '#d7a08f',
  },
  {
    label: 'Subcortical grey matter',
    valueMm3: 43814,
    color: '#6f93c7',
  },
  {
    label: 'Ventricles + choroid plexus',
    valueMm3: 16358,
    color: '#8a7cb4',
  },
];

export const freesurferTopCorticalRegions = freesurferCorticalRegions;
