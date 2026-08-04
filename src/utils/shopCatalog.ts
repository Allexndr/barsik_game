export type ShopCategory = 'city';

export interface ShopItem {
  id: string;
  name: { ru: string; kk: string };
  description: { ru: string; kk: string };
  cost: number;
  category: ShopCategory;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'city_tree',
    name: { ru: 'Дерево', kk: 'Ағаш' },
    description: {
      ru: 'Зелёное дерево для площади города',
      kk: 'Қала алаңына арналған жасыл ағаш',
    },
    cost: 15,
    category: 'city',
  },
  {
    id: 'city_lamp',
    name: { ru: 'Фонарик', kk: 'Шам' },
    description: { ru: 'Светит друзьям вечером', kk: 'Кешке достарға жарық береді' },
    cost: 20,
    category: 'city',
  },
  {
    id: 'city_bench',
    name: { ru: 'Скамейка', kk: 'Орындық' },
    description: { ru: 'Место, где друзья отдыхают', kk: 'Достар демалатын орын' },
    cost: 25,
    category: 'city',
  },
  {
    id: 'city_fountain',
    name: { ru: 'Фонтан', kk: 'Субұрқақ' },
    description: { ru: 'Брызги и радуга на площади', kk: 'Алаңдағы су тамшылары мен кемпірқосақ' },
    cost: 40,
    category: 'city',
  },
];
