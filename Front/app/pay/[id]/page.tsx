import React, { Suspense } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { PayClient } from "./pay-client";

interface PayPageProps {
  params: Promise<{ id: string }>;
}

export default async function PayPage({ params }: PayPageProps) {
  const { id } = await params;

  return (
    <ToastProvider>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] text-sm text-gray-500">
            Chargement de la passerelle de paiement...
          </div>
        }
      >
        <PayClient id={id} />
      </Suspense>
    </ToastProvider>
  );
}
