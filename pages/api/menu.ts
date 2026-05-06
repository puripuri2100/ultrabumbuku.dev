import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { MenuItem } from '../../types/types';
import storesData from './sushiro_data/sushiro_all_shops.json';

type MenuResponse = MenuItem[] | { error: string };
type Store = { name: string; url: string };

const TAKEOUT_KEYWORDS = ['お持ち帰り', 'テイクアウト'];

const EXCLUDE_ITEM_NAMES = [
  '生ビール', '生貯蔵酒', '翠', 'レモンサワー', 'ハイボール', 'オールフリー',
  '特上セット', 'スシローセット', 'まぐろサーモンセット', 'スシロー手巻セット',
  '粉末緑茶', '赤だし（カップ）', '甘だれ',
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MenuResponse>
) {
  const { storeName } = req.query;

  if (!storeName || typeof storeName !== 'string') {
    return res.status(400).json({ error: '店舗名が指定されていません' });
  }

  const store = (storesData as Store[]).find(s => s.name === storeName);
  if (!store) {
    return res.status(404).json({ error: '店舗が見つかりません' });
  }

  const menuUrl = store.url.startsWith('https://') ? store.url : `https://${store.url}`;

  try {
    const menuResponse = await axios.get(menuUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    const $ = cheerio.load(menuResponse.data);

    // カテゴリタブ: data-target → カテゴリ名
    const categoryNames: Record<number, string> = {};
    $('[class*="category-tab__item"]').each((_, el) => {
      const target = $(el).attr('data-target');
      const name = $(el).text().trim();
      if (target !== undefined && name) {
        categoryNames[parseInt(target)] = name;
      }
    });

    // コンテンツ用 swiper-slide のみ対象（category-tab__item と modal-container を除外）
    const contentSlides = $('.swiper-slide').filter((_, el) => {
      return !$(el).hasClass('category-tab__item') && !$(el).closest('.modal-container').length;
    });

    if (contentSlides.length === 0) {
      return res.status(404).json({ error: 'メニュー情報が見つかりませんでした' });
    }

    const menuList: MenuItem[] = [];

    contentSlides.each((i, slide) => {
      const catName = categoryNames[i] ?? 'その他';
      if (TAKEOUT_KEYWORDS.some(kw => catName.includes(kw))) return;

      $(slide).find('.menu-item').each((_, element) => {
        const name = $(element).find('.menu-item__name').text().trim();
        if (!name) return;
        if (EXCLUDE_ITEM_NAMES.some(n => name.includes(n))) return;
        const priceText = $(element).find('.menu-item__price').text().replace(/\s+/g, '').trim();
        const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(price)) {
          menuList.push({ name, price, category: catName });
        }
      });
    });

    if (menuList.length === 0) {
      return res.status(404).json({ error: 'メニュー情報の解析に失敗しました' });
    }

    res.status(200).json(menuList);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'メニューの取得中にエラーが発生しました' });
  }
}
