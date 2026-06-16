import { Suspense } from 'react';
import ActualizarPasswordClient from './ActualizarPasswordClient';

export default function ActualizarPasswordPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ActualizarPasswordClient />
    </Suspense>
  );
}
