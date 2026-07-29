export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  isOnline: boolean;
  color: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
  isEdited: boolean;
  isDeleted: boolean;
  replyTo?: { id: string; text: string; senderName: string };
  media?: { type: "image" | "file"; url: string; name: string; size?: number };
}

export interface Workspace {
  id: string;
  name: string;
  memberCount: number;
  members: TeamMember[];
}
