export type Basket = {
  id: string;
  name: string;
  status: "INIT" | "ACTIVE" | string;
  created_at: string;
};
