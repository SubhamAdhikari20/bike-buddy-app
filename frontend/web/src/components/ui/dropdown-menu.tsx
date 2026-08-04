"use client";

import type { ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

const DropdownMenu = Menu.Root;

function DropdownMenuTrigger(props: Menu.Trigger.Props) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  side = "bottom",
  align = "end",
  sideOffset = 6,
  children,
  ...props
}: Menu.Popup.Props &
  Pick<Menu.Positioner.Props, "side" | "align" | "sideOffset"> & {
    children?: ReactNode;
  }) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "min-w-44 origin-(--transform-origin) rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: Menu.Item.Props & { variant?: "default" | "destructive" }) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: Menu.Separator.Props) {
  return (
    <Menu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, ...props }: Menu.GroupLabel.Props) {
  return (
    <Menu.GroupLabel
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2.5 py-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
