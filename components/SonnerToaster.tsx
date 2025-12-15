"use client";

/**
 * SonnerToaster.tsx
 *
 * What this file does
 * - Shows small, temporary on-screen messages ("toasts") such as “Saved” or
 *   “Something went wrong”. Each message appears briefly and then goes away on its own.
 * - Provides the invisible container that displays those messages for the whole app.
 * - Applies our CSS module styles so all messages look consistent.
 *
 * Important
 * - This container is already added at the app level. Do not add another one
 *   on a page or component, or you may see duplicate behavior.
 *
 * How it works
 * - Wraps `sonner`’s `Toaster` component and passes in our CSS classes from
 *   `SonnerToaster.module.css` via `toastOptions.classNames`.
 * - You can trigger messages from anywhere with `import { toast } from "sonner";`.
 *
 * See: `components/SonnerToaster.module.css`
 */
import { Toaster as Sonner } from "sonner";
import styles from "./SonnerToaster.module.css";

/**
 * Props accepted by `SonnerToaster`.
 * Mirrors `sonner`'s `Toaster` props and allows an optional `className` to add
 * extra styling to the outer element if needed.
 */
type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * SonnerToaster
 *
 * The app-wide container that shows quick pop-up messages and then removes them
 * after a few seconds. Already mounted globally; avoid adding more than one.
 *
 * @param className Optional extra CSS class for the container element.
 * @param props     Any other options supported by `sonner`’s `Toaster`.
 *
 * Example usage for showing a message (not in this file):
 * ```tsx
 * import { toast } from "sonner";
 * toast("Saved your changes");
 * toast.error("Could not generate palette");
 * ```
 */
export const SonnerToaster = ({ className, ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-center"
      gap={12}
      className={`${styles.toaster} ${className ?? ""}`}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: String(styles.toast ?? ''),
          content: String(styles.content ?? ''),
          title: String(styles.title ?? ''),
          actionButton: String(styles.actionButton ?? ''),
          cancelButton: String(styles.cancelButton ?? ''),
          closeButton: String(styles.closeButton ?? ''),
          description: String(styles.description ?? ''),
          icon: String(styles.icon ?? ''),
        },
      }}
      {...props}
    />
  );
};
