import Image from "next/image";

interface BrandLogoProps {
  priority?: boolean;
}

export function BrandLogo({ priority = false }: BrandLogoProps) {
  return (
    // The source icon has generous transparent padding; frame the actual wordmark.
    <span className="relative block h-11 w-24 shrink-0 overflow-hidden sm:h-12 sm:w-[108px]">
      <Image
        src="/icon.png"
        alt="Coffee Sphut"
        width={1600}
        height={1600}
        priority={priority}
        className="absolute -left-7 -top-12.5 w-36 max-w-none sm:-left-8 sm:-top-14 sm:w-40"
      />
    </span>
  );
}
