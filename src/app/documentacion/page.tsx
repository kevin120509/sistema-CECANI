'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DocumentacionPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir a la página principal donde se maneja el estado de los pasos
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Cargando...</p>
      </div>
    </div>
  );
}
