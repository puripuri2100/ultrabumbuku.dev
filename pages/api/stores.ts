import type { NextApiRequest, NextApiResponse } from 'next';
import storesData from './sushiro_data/sushiro_all_shops.json';

type Store = { name: string; url: string };

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Store[]>
) {
  res.status(200).json(storesData as Store[]);
}
