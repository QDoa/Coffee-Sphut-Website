import { Suspense } from "react";
import { RewardLoading } from "@/components/reward-loading";
import VendorRewardClient from "./VendorRewardClient";

export default function VendorRewardPage() {
  return (
    <Suspense fallback={<RewardLoading />}>
      <VendorRewardClient />
    </Suspense>
  );
}
