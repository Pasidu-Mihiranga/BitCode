import { t } from "elysia";

export const RegisterBody = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
  displayName: t.String({ minLength: 1, maxLength: 60 }),
  password: t.String({ minLength: 8, maxLength: 200 }),
});

export const LoginBody = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
  password: t.String({ minLength: 1, maxLength: 200 }),
});

export const ChangePasswordBody = t.Object({
  currentPassword: t.String({ minLength: 1, maxLength: 200 }),
  newPassword: t.String({ minLength: 8, maxLength: 200 }),
});
