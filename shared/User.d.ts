export interface User {
    id: string;
    email: string;
    displayName: string;
    role: 'user' | 'admin';
    status: 'active' | 'inactive' | 'suspended';
    createdAt: string;
    updatedAt: string;
}
export interface UserWithPassword extends User {
    passwordHash: string;
}
//# sourceMappingURL=User.d.ts.map