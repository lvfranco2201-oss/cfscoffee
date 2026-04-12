import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/utils/supabase/server';

// Admin client usa SERVICE_ROLE_KEY — solo para operaciones de users en servidor
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Verifica que el request viene de un usuario válido.
 */
async function requireAdmin(): Promise<{ authorized: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { authorized: false, error: 'No autenticado' };
    }

    return { authorized: true };
  } catch {
    return { authorized: false, error: 'Error de autorización' };
  }
}
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  try {
    const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      throw error;
    }

    const users = authUsers.users.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? '',
      role: u.user_metadata?.role ?? u.user_metadata?.user_role ?? 'MANAGER',
      created_at: u.created_at
    }));

    // sort by created_at desc
    users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  try {
    const { email, password, full_name, role } = await req.json();

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Faltan campos requeridos (email, password, full_name)' }, { status: 400 });
    }

    if (!['ADMIN', 'MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Rol inválido. Use ADMIN o MANAGER.' }, { status: 400 });
    }

    // 1. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (authError) throw authError;

    // 2. Actualizar el perfil creado por el trigger SQL
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name, role })
      .eq('id', authData.user.id);

    if (updateError) {
      // Si profiles no existe aún, no es crítico — el usuario Auth fue creado
      if (updateError.code !== '42P01') throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create user error:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  try {
    const { id, email, password, full_name, role } = await req.json();

    if (!id || !email || !full_name) {
      return NextResponse.json({ error: 'Faltan campos requeridos (id, email, full_name)' }, { status: 400 });
    }

    if (!['ADMIN', 'MANAGER'].includes(role)) {
      return NextResponse.json({ error: 'Rol inválido. Use ADMIN o MANAGER.' }, { status: 400 });
    }

    const updateData: any = {
      email,
      user_metadata: { full_name, role },
    };

    if (password && password.trim() !== '') {
      updateData.password = password;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      updateData
    );

    if (authError) throw authError;

    // Actualizar también en profiles (ignorar si falla)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name, role })
      .eq('id', id);

    if (updateError && updateError.code !== '42P01') {
      console.warn('Could not update profiles table:', updateError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update user error:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID del usuario' }, { status: 400 });
    }

    // Evitar que el admin se auto-elimine
    const supabase = await createServerSupabase();
    const { data: { user: requester } } = await supabase.auth.getUser();
    if (requester?.id === id) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
    }

    // El ON DELETE CASCADE en la tabla profiles borrará el perfil automáticamente
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete user error:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
