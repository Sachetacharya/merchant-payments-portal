import { Injectable } from '@nestjs/common';

interface RefreshSession {
  userId: string;
}

@Injectable()
export class RefreshTokenStore {
  private readonly sessions = new Map<string, RefreshSession>();

  save(userId: string, tokenId: string): void {
    this.sessions.set(tokenId, { userId });
  }

  consume(userId: string, tokenId: string): boolean {
    const session = this.sessions.get(tokenId);
    if (!session || session.userId !== userId) {
      return false;
    }
    this.sessions.delete(tokenId);
    return true;
  }

  revokeAllForUser(userId: string): void {
    for (const [tokenId, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(tokenId);
      }
    }
  }
}
