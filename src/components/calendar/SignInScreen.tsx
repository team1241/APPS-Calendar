"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import type React from "react";
import { useState } from "react";

export function SignInScreen({
  authMode,
  onToggleMode,
}: {
  authMode: "signin" | "signup";
  onToggleMode: () => void;
}) {
  const {
    isLoaded: signInLoaded,
    signIn,
    setActive: setSignInActive,
  } = useSignIn();
  const {
    isLoaded: signUpLoaded,
    signUp,
    setActive: setSignUpActive,
  } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationMode, setVerificationMode] = useState<
    "signin" | "signup" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getErrorMessage = (value: unknown): string => {
    if (value instanceof Error) {
      return value.message;
    }
    if (typeof value === "object" && value !== null && "errors" in value) {
      const { errors } = value as {
        errors?: Array<{ longMessage?: string; message?: string }>;
      };
      const firstError = errors?.[0];
      if (firstError) {
        return (
          firstError.longMessage ??
          firstError.message ??
          "Authentication failed."
        );
      }
    }
    return "Authentication failed. Please check your details and try again.";
  };

  const submitSignUpCode = async () => {
    if (!(signUpLoaded && signUp && setSignUpActive)) {
      throw new Error("Authentication is still loading.");
    }
    const result = await signUp.attemptEmailAddressVerification({
      code: verificationCode,
    });
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error("The verification code was not accepted yet.");
    }
    await setSignUpActive({ session: result.createdSessionId });
  };

  const submitSignInCode = async () => {
    if (!(signInLoaded && signIn && setSignInActive)) {
      throw new Error("Authentication is still loading.");
    }
    const result = await signIn.attemptFirstFactor({
      code: verificationCode,
      strategy: "email_code",
    });
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error("The verification code was not accepted yet.");
    }
    await setSignInActive({ session: result.createdSessionId });
  };

  const startSignIn = async () => {
    if (!(signInLoaded && signIn && setSignInActive)) {
      throw new Error("Authentication is still loading.");
    }
    const result = await signIn.create({
      identifier: email.trim(),
      strategy: "email_code",
    });
    if (result.status === "complete" && result.createdSessionId) {
      await setSignInActive({ session: result.createdSessionId });
    } else {
      setVerificationCode("");
      setVerificationMode("signin");
    }
  };

  const startSignUp = async () => {
    if (!(signUpLoaded && signUp && setSignUpActive)) {
      throw new Error("Authentication is still loading.");
    }
    const result = await signUp.create({
      emailAddress: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
    if (result.status === "complete" && result.createdSessionId) {
      await setSignUpActive({ session: result.createdSessionId });
    } else {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerificationMode("signup");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (verificationMode === "signup") {
        await submitSignUpCode();
        return;
      }
      if (verificationMode === "signin") {
        await submitSignInCode();
        return;
      }
      if (!email.trim()) {
        throw new Error("Enter your email address to continue.");
      }
      if (authMode === "signin") {
        await startSignIn();
      } else {
        await startSignUp();
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signin-wrap">
      <div className="top-glow" style={{ height: 320 }} />
      <div className="signin-top">
        <div className="topbar-brand">
          <span className="team-logo">
            <Image
              alt="THEORY6 team logo"
              height={18}
              src="/Circle_Logo_Theory.png"
              width={18}
            />
          </span>
          <span>FRC 1241</span>
        </div>
      </div>
      <div className="signin-card-wrap">
        <div className="signin-card">
          <div className="glow" />
          <form onSubmit={handleSubmit} style={{ position: "relative" }}>
            {error && (
              <p className="signin-error" role="alert">
                {error}
              </p>
            )}
            {verificationMode ? (
              <>
                <div className="micro-label">Check your email</div>
                <h1>
                  Enter your
                  <br />
                  verification code.
                </h1>
                <p className="sub">We sent a verification code to {email}.</p>
                <div className="micro-label" style={{ marginBottom: 8 }}>
                  Verification code
                </div>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="Enter your code"
                  style={{ marginBottom: 26 }}
                  value={verificationCode}
                />
                <button
                  className="primary-btn"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Verifying..." : "Verify"}{" "}
                  <HugeiconsIcon
                    icon={ArrowRight02Icon}
                    size={16}
                    strokeWidth={2}
                  />
                </button>
              </>
            ) : null}
            {!verificationMode && authMode === "signup" ? (
              <>
                <div className="micro-label">Get started</div>
                <h1>
                  Create your
                  <br />
                  team calendar account.
                </h1>
                <p className="sub">
                  Every meeting, deadline, and build session ? in one place,
                  always up to date.
                </p>
                <div className="signin-name-row" style={{ marginBottom: 18 }}>
                  <div className="signin-field">
                    <div className="micro-label" style={{ marginBottom: 8 }}>
                      First name
                    </div>
                    <input
                      autoComplete="given-name"
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="First name"
                      value={firstName}
                    />
                  </div>
                  <div className="signin-field">
                    <div className="micro-label" style={{ marginBottom: 8 }}>
                      Last name
                    </div>
                    <input
                      autoComplete="family-name"
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Last name"
                      value={lastName}
                    />
                  </div>
                </div>
                <div className="micro-label" style={{ marginBottom: 8 }}>
                  Email address
                </div>
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  style={{ marginBottom: 26 }}
                  type="email"
                  value={email}
                />
                <button
                  className="primary-btn"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Creating..." : "Continue"}{" "}
                  <HugeiconsIcon
                    icon={ArrowRight02Icon}
                    size={16}
                    strokeWidth={2}
                  />
                </button>
                <div className="signin-alt-row">
                  Already have an account?{" "}
                  <button
                    onClick={onToggleMode}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onToggleMode();
                      }
                    }}
                    type="button"
                  >
                    Sign in
                  </button>
                </div>
              </>
            ) : null}
            {!verificationMode && authMode !== "signup" ? (
              <>
                <div className="micro-label">Welcome back</div>
                <h1>
                  Sign in to your
                  <br />
                  team calendar.
                </h1>
                <p className="sub">
                  Every meeting, deadline, and build session ? in one place,
                  always up to date.
                </p>
                <div className="micro-label" style={{ marginBottom: 8 }}>
                  Email address
                </div>
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  style={{ marginBottom: 26 }}
                  type="email"
                  value={email}
                />
                <button
                  className="primary-btn"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Signing in..." : "Continue"}{" "}
                  <HugeiconsIcon
                    icon={ArrowRight02Icon}
                    size={16}
                    strokeWidth={2}
                  />
                </button>
                <div className="signin-alt-row">
                  Don&apos;t have an account?{" "}
                  <button
                    onClick={onToggleMode}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onToggleMode();
                      }
                    }}
                    type="button"
                  >
                    Sign up
                  </button>
                </div>
              </>
            ) : null}
          </form>
        </div>
      </div>
      <p className="signin-footer">Powered by Clerk authentication.</p>
    </div>
  );
}
