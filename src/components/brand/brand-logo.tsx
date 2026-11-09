import Image from "next/image";
import type { ReactNode, Ref } from "react";

export type BrandLogoVariant = "dark" | "light";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className: string;
  priority?: boolean;
  sizes?: string;
  animatedScrew?: boolean;
  screwRef?: Ref<HTMLSpanElement>;
  children?: ReactNode;
};

/** Official ZAPTUT wordmark, cropped and palette-normalized from the approved master. */
export function BrandLogo({
  variant = "dark",
  className,
  priority = false,
  sizes = "(max-width: 640px) 180px, 240px",
  animatedScrew = false,
  screwRef,
  children,
}: BrandLogoProps) {
  const source = animatedScrew
    ? "/brand/zaptut-logo-loader-base.png"
    : variant === "dark"
      ? "/brand/zaptut-logo-dark.png"
      : "/brand/zaptut-logo-light.png";

  return (
    <span className={`brand-logo ${className}`}>
      <Image
        src={source}
        alt="ZAPTUT.PRO"
        fill
        priority={priority}
        sizes={sizes}
        className="object-contain"
      />
      {animatedScrew && (
        <span ref={screwRef} className="brand-logo__screw" aria-hidden="true">
          <Image src="/brand/zaptut-screw.png" alt="" fill sizes="44px" className="object-contain" />
        </span>
      )}
      {children}
    </span>
  );
}
