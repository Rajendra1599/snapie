import fs from 'fs';
import path from 'path';

export interface HeroConfigDto {
  picture1_url: string; // Left tilted polaroid image
  picture2_url: string; // Right tilted polaroid image
  title: string;
  subtitle: string;
  button_text: string;
}

const HERO_FILE = path.join(__dirname, 'custom_hero.json');

export const DEFAULT_HERO_CONFIG: HeroConfigDto = {
  picture1_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80',
  picture2_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80',
  title: 'aesthetic\nfilters',
  subtitle: 'Film looks and pro adjustments, free on any photo.',
  button_text: 'SELECT A PHOTO',
};

export function loadHeroConfig(): HeroConfigDto {
  try {
    if (!fs.existsSync(HERO_FILE)) {
      fs.writeFileSync(HERO_FILE, JSON.stringify(DEFAULT_HERO_CONFIG, null, 2));
      return DEFAULT_HERO_CONFIG;
    }
    const content = fs.readFileSync(HERO_FILE, 'utf-8');
    const config: HeroConfigDto = JSON.parse(content);
    return config;
  } catch (err) {
    console.error('[HeroStorage] Error reading custom_hero.json:', err);
    return DEFAULT_HERO_CONFIG;
  }
}

export function saveHeroConfig(config: Partial<HeroConfigDto>): HeroConfigDto {
  try {
    const current = loadHeroConfig();
    const updated: HeroConfigDto = {
      ...current,
      ...config,
    };
    fs.writeFileSync(HERO_FILE, JSON.stringify(updated, null, 2));
    return updated;
  } catch (err) {
    console.error('[HeroStorage] Error saving custom_hero.json:', err);
    return DEFAULT_HERO_CONFIG;
  }
}
