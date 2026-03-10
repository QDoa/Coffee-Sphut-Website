import { Suspense } from "react"
import VendorRewardClient from "./VendorRewardClient";

export default function VendorRewardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><span>Loading...</span></div>}>
      <VendorRewardClient />
    </Suspense>
  )
}

