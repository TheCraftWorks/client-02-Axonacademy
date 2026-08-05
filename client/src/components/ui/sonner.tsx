import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ position = "top-center", ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position={position}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-yellow-400 group-[.toaster]:!text-zinc-950 group-[.toaster]:!border-yellow-500 group-[.toaster]:shadow-2xl group-[.toaster]:font-semibold group-[.toaster]:text-sm",
          description: "group-[.toast]:!text-zinc-800",
          actionButton: "group-[.toast]:!bg-zinc-950 group-[.toast]:!text-zinc-50",
          cancelButton: "group-[.toast]:!bg-zinc-200 group-[.toast]:!text-zinc-800",
          success: "group-[.toast]:!bg-yellow-400 group-[.toast]:!text-zinc-950 group-[.toast]:!border-yellow-500",
          error: "group-[.toast]:!bg-yellow-400 group-[.toast]:!text-zinc-950 group-[.toast]:!border-yellow-500",
          info: "group-[.toast]:!bg-yellow-400 group-[.toast]:!text-zinc-950 group-[.toast]:!border-yellow-500",
          warning: "group-[.toast]:!bg-yellow-400 group-[.toast]:!text-zinc-950 group-[.toast]:!border-yellow-500",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
