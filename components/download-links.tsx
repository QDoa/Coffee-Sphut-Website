import Image from "next/image";
import { TrackedLink } from "@/components/tracked-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DownloadLinksProps {
  className?: string;
}

export function DownloadLinks({ className }: DownloadLinksProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <TrackedLink
        href="https://apps.apple.com/us/app/coffee-sphut/id6759900667"
        target="_blank"
        rel="noopener noreferrer"
        eventName="Download iOS"
        className={cn(
          buttonVariants({ variant: "default", size: "lg" }),
          "h-12 px-5 motion-safe:active:scale-[0.98]",
        )}
      >
        <Image
          src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/apple_logo.png"
          alt=""
          width={20}
          height={20}
        />
        Get on iOS
      </TrackedLink>
      <TrackedLink
        href="https://play.google.com/store/apps/details?id=com.coffeesphut.app"
        target="_blank"
        rel="noopener noreferrer"
        eventName="Download Android"
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "h-12 px-5 motion-safe:active:scale-[0.98]",
        )}
      >
        <Image
          src="https://1iustwinxvwsck3s.public.blob.vercel-storage.com/play_store.png"
          alt=""
          width={20}
          height={20}
        />
        Get on Android
      </TrackedLink>
    </div>
  );
}
