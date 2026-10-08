import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  alt?: string;
  priority?: boolean;
};

export default function BrandLogo({
  className = "h-10 w-10 rounded-xl",
  alt = "AI UPCHAR logo",
  priority = false,
}: BrandLogoProps) {
  return (
    <span className={`relative inline-flex shrink-0 overflow-hidden ${className}`}>
      <Image
        src="/ai-upchar-logo.png"
        alt={alt}
        fill
        sizes="(max-width: 768px) 64px, 128px"
        className="object-contain"
        priority={priority}
      />
    </span>
  );
}


