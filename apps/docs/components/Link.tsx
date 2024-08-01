import NextLink from "next/link";
import { tv, type VariantProps } from "tailwind-variants";
import { ExternalLink } from "lucide-react";

const link = tv({
  base: "underline",
  variants: {
    type: {
      internal: "text-violet-500",
      external: "text-blue-500",
    },
  },
  defaultVariants: {
    type: "internal",
  },
});

type LinkVariants = VariantProps<typeof link>;
type LinkProps = React.ComponentProps<typeof NextLink> & LinkVariants;

const Link = ({ children, className, type, ...rest }: LinkProps) => {
  const classes = link({ type, className });

  return (
    <NextLink
      className={classes}
      target={type === "external" ? "_blank" : ""}
      {...rest}
    >
      {children}{" "}
      {type === "external" && (
        <ExternalLink size={16} className="ms-1 inline" />
      )}
    </NextLink>
  );
};

export default Link;
