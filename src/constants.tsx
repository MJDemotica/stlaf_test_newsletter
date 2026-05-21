/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Facebook, 
  Instagram, 
  Music2, 
  Linkedin, 
  Twitter, 
  Youtube, 
  Globe 
} from 'lucide-react';

export const CONTENT_TITLES = [
  'TOTD',
  'BLOG',
  'REEL',
  'JURISPRUDENCE',
  'STATIC',
  'DOTD',
  'LMOTD',
  'TOTD/STATIC'
];

export const CONTENT_TYPES = [
  'Educate',
  'Engage',
  'Promote',
  'Entertain'
];

export const FORMATS = [
  'Carousel',
  'Article',
  'Reel',
  'Post',
  'Story',
  'Video'
];

export const FUNNEL_STATUSES = [
  'Awareness',
  'Consideration',
  'Conversion',
  'Retention'
];

export const SUPPORTED_SOCIAL_PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
  { id: 'tiktok', label: 'TikTok', icon: Music2, color: '#000000' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
  { id: 'twitter', label: 'Twitter / X', icon: Twitter, color: '#000000' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000' },
  { id: 'website', label: 'Website', icon: Globe, color: '#6366F1' },
];
