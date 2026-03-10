import { Suspense } from "react"
import RedeemRewardClient from "./RedeemRewardClient"

export default function RedeemRewardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><span>Loading...</span></div>}>
      <RedeemRewardClient />
    </Suspense>
  )
}
