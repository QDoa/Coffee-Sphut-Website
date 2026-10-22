import { Suspense } from "react";
import { RewardLoading } from "@/components/reward-loading";
import RedeemRewardClient from "./RedeemRewardClient";

export default function RedeemRewardPage() {
  return (
    <Suspense fallback={<RewardLoading />}>
      <RedeemRewardClient />
    </Suspense>
  );
}
