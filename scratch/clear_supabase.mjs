import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function clearSupabase() {
  // 1. Limpiar Storage
  const buckets = ["documentos_cliente", "contratos", "contratos_oficiales"];
  for (const bucket of buckets) {
    console.log(`Cleaning bucket: ${bucket}`);
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(bucket)
      .list();

    if (listError) {
      console.error(`Error listing bucket ${bucket}:`, listError.message);
      continue;
    }

    if (files && files.length > 0) {
      console.log(`Deleting ${files.length} files from ${bucket}...`);
      const paths = files.map((f) => f.name);
      const { error: deleteError } = await supabaseAdmin.storage
        .from(bucket)
        .remove(paths);

      if (deleteError) {
        console.error(`Error deleting from ${bucket}:`, deleteError.message);
      }
    }
  }

  // 2. Limpiar Usuarios de Auth (que no sean directoras)
  console.log("Cleaning Auth users...");
  const { data: profiles } = await supabaseAdmin
    .from("perfiles")
    .select("id")
    .eq("rol", "directora");

  const directorIds = new Set(profiles?.map((p) => p.id) || []);

  const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();

  if (authError) {
    console.error("Error listing auth users:", authError.message);
  } else {
    for (const user of users) {
      if (!directorIds.has(user.id)) {
        console.log(`Deleting user: ${user.email} (${user.id})`);
        const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (delError) {
          console.error(`Error deleting user ${user.id}:`, delError.message);
        }
      } else {
        console.log(`Keeping director user: ${user.email}`);
      }
    }
  }

  console.log("Supabase cleanup finished.");
}

clearSupabase().catch(console.error);
