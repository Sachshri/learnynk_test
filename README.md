# LearnLynk – Technical Assessment Submission

This repository contains my submission for the LearnLynk technical test. I have implemented the full stack requirements using **Supabase (Postgres, Edge Functions)** and **Next.js**.

Below is a breakdown of my implementation choices, assumptions, and the required Stripe integration plan.

---

## 🚀 Quick Start

1.  **Install dependencies:**
    ```bash
    cd frontend
    npm install
    ```

2.  **Environment Setup:**
    Create a `.env.local` file in the `frontend` root:
    ```bash
    NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key"
    ```

3.  **Run the Frontend:**
    ```bash
    npm run dev
    ```
    Navigate to `http://localhost:3000/dashboard/today` to view the dashboard.

---

## 🛠️ Implementation Details

### 1. Database Schema (`backend/schema.sql`)
I structured the database to ensure data integrity and query performance:
* **Foreign Keys:** strict cascading deletes on `applications` and `tasks` to prevent orphaned records.
* **Constraints:** Added checks to ensure `due_at` is always in the future relative to creation, and restricted `task_type` to specific enums.
* **Indexing:** created indexes on high-traffic columns (`tenant_id`, `status`, `owner_id`) to optimize the specific queries mentioned in the requirements.

### 2. RLS & Security (`backend/rls_policies.sql`)
For the security layer, I utilized Supabase's `auth.jwt()` to enforce tenant isolation:
* **Counselor Access:** I used a complex policy that joins `user_teams` to allow counselors to see leads owned by anyone in their immediate team, not just themselves.
* **Admin Access:** Grants full read access based on the `app_metadata` role.

### 3. Edge Function (`backend/edge-functions/create-task`)
I built a robust API endpoint that prioritizes validation:
* **Validation:** Strict type checking for `task_type` and date validation to ensure `due_at` is in the future.
* **Security:** The function creates the Supabase client using the **Service Role Key** (server-side only) to bypass RLS for the insertion, while still validating the input.
* **Realtime:** Emits a `task.created` broadcast event so the frontend can react instantly (extensible for notifications).

### 4. Frontend Dashboard (`frontend/pages/dashboard/today.tsx`)
For the requested dashboard page:
* **Date Filtering:** I implemented strict filtering to show only tasks due between `00:00` and `23:59` of the current day.
* **UX Optimization:** When a user clicks "Mark Complete", I implemented an **optimistic UI update**. This removes the task from the view immediately for a snappy feel, while the API request processes in the background.

---

## ## Stripe Answer (Section 5)

**Implementation Plan for Application Fee Checkout:**

To implement Stripe Checkout for an application fee, I would first insert a row into a `payment_requests` table with status `pending` and the associated `application_id`. I would then call `stripe.checkout.sessions.create`, passing the `payment_requests.id` in the `client_reference_id` field or `metadata` to link the session to my database record. I would store the returned `stripe_session_id` and redirect the user to the Stripe URL. 

To handle the completion, I would set up a webhook endpoint listening for `checkout.session.completed`. After verifying the Stripe signature to prevent spoofing, I would parse the event to retrieve the `client_reference_id`. Using this ID, I would update the `payment_requests` status to `paid` and trigger a database update to move the `application` stage to 'submitted' or 'processing'.