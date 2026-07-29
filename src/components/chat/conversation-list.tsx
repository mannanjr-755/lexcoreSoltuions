"use client";

import { Hash } from "lucide-react";
import type { Workspace, TeamMember } from "./chat-types";
import { cn } from "@/lib/utils";

interface WorkspaceSidebarProps {
  workspace: Workspace;
  selected: boolean;
  currentUserEmail: string;
  onSelect: () => void;
}

function MemberAvatar({ member, size = "sm" }: { member: TeamMember; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-xs";
  return (
    <div className="relative shrink-0">
      <div
        className={cn("flex items-center justify-center rounded-full font-bold text-white", dim)}
        style={{ backgroundColor: member.color }}
      >
        {member.name[0]}
      </div>
      {member.isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-[#22C55E]" />
      )}
    </div>
  );
}

export function ConversationList({ workspace, selected, currentUserEmail, onSelect }: WorkspaceSidebarProps) {
  const onlineCount = workspace.members.filter((m) => m.isOnline).length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#E2E8F0] px-4 py-3.5">
        <h2 className="text-sm font-semibold text-[#0F172A]">Team Chat</h2>
        <p className="mt-0.5 text-[11px] text-[#64748B]">{onlineCount} of {workspace.members.length} online</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-all duration-150",
            selected ? "bg-[#EFF6FF]" : "hover:bg-[#F8FAFC]"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#2563EB]">
            <Hash className="size-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-[#0F172A]">{workspace.name}</span>
            <p className="mt-0.5 text-[11px] text-[#64748B]">{workspace.members.length} members</p>
          </div>
        </button>

        <div className="border-t border-[#E2E8F0] px-4 py-3">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Members
          </p>
          <div className="space-y-1">
            {workspace.members.map((member) => {
              const isYou = member.email === currentUserEmail;
              return (
                <div key={member.id} className="flex items-center gap-2.5 rounded-[8px] px-2 py-1.5">
                  <MemberAvatar member={member} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[#0F172A]">
                      {member.name}{isYou && <span className="ml-1 text-[10px] text-[#64748B]">(you)</span>}
                    </p>
                    <p className="truncate text-[10px] text-[#64748B]">{member.email}</p>
                  </div>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      member.isOnline ? "bg-[#22C55E]" : "bg-[#94A3B8]"
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
