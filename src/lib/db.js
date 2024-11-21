import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

process.env.NODE_ENV !== 'production' && config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY,
);

export default supabase;