import * as React from "react";
import { motion } from "framer-motion";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CreateCollabCardProps {
  onSubmit: (data: { name: string; hostName: string; budget: number }) => void;
  onCancel: () => void;
  className?: string;
  isCreating?: boolean;
}

export const CreateCollabCard: React.FC<CreateCollabCardProps> = ({
  onSubmit,
  onCancel,
  className,
  isCreating = false,
}) => {
  const [name, setName] = React.useState("Hackathon Pizza Night");
  const [hostName, setHostName] = React.useState("Host");
  const [budgetStr, setBudgetStr] = React.useState("1000");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, hostName, budget: parseInt(budgetStr) || 0 });
  };

  const FADE_IN_VARIANTS = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring" } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      viewport={{ once: true }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.15,
          },
        },
      }}
      className={cn(
        "relative w-full rounded-xl bg-background p-6",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <motion.h3 variants={FADE_IN_VARIANTS} className="text-xl font-semibold text-foreground">
          Create Collaborative Cart
        </motion.h3>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close" disabled={isCreating}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <motion.div variants={FADE_IN_VARIANTS} className="grid w-full items-center gap-1.5">
            <Label htmlFor="session-name">
              Session Name <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              id="session-name"
              placeholder="e.g. Goa Trip Fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isCreating}
            />
          </motion.div>

          <motion.div variants={FADE_IN_VARIANTS} className="grid w-full items-center gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="host-name">Your Name <span className="text-red-500">*</span></Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-pointer text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Your display name in the session.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="text"
              id="host-name"
              placeholder="e.g. Rahul"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              required
              disabled={isCreating}
            />
          </motion.div>

          <motion.div variants={FADE_IN_VARIANTS} className="grid w-full items-center gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="budget">Total Budget (₹)</Label>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                type="number"
                id="budget"
                className="pl-7"
                placeholder="1000"
                min="0"
                value={budgetStr}
                onChange={(e) => setBudgetStr(e.target.value)}
                required
                disabled={isCreating}
              />
            </div>
          </motion.div>
        </div>

        <motion.div variants={FADE_IN_VARIANTS} className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Cart"}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
};
