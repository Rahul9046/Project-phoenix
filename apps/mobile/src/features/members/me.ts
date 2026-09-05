import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/features/auth/SessionProvider";

/**
 * Your own profile, as names rather than ids.
 *
 * The session snapshot holds `cityId` and `languageIds`, which is what
 * onboarding needs to write and what the routing rules need to read. Screens
 * need the readable versions -- "Pune", "Marathi" -- for the account page and
 * for the "also in Pune" line on a discovery card.
 *
 * There is deliberately no `member_card` for yourself. That type is the shape of
 * what one member may learn about *another*, and routing your own data through
 * it would mean the moment someone added a field for their own screen, every
 * other member would see it too.
 */

export type MyDetails = {
  cityName: string | null;
  stateName: string | null;
  languageNames: string[];
  about: string | null;
  lookingFor: string | null;
  photoPaths: string[];
};

const empty: MyDetails = {
  cityName: null,
  stateName: null,
  languageNames: [],
  about: null,
  lookingFor: null,
  photoPaths: [],
};

export async function getMyDetails(): Promise<MyDetails> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return empty;

  const [profileResult, languageResult, photoResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("about, looking_for, other_city, cities(name, state)")
      .eq("id", me)
      .maybeSingle(),
    supabase
      .from("profile_languages")
      .select("languages(name)")
      .eq("profile_id", me),
    supabase
      .from("profile_photos")
      .select("storage_path")
      .eq("profile_id", me)
      .order("position", { ascending: true }),
  ]);

  const row = profileResult.data;
  const city = row?.cities as { name?: string; state?: string } | null;

  return {
    cityName: city?.name ?? row?.other_city ?? null,
    stateName: city?.state ?? null,
    languageNames: (languageResult.data ?? [])
      .map((entry) => (entry.languages as { name?: string } | null)?.name)
      .filter((name): name is string => Boolean(name))
      .sort(),
    about: row?.about ?? null,
    lookingFor: row?.looking_for ?? null,
    photoPaths: (photoResult.data ?? []).map((entry) => entry.storage_path),
  };
}

export function useMyDetails() {
  const { session } = useSession();
  const [details, setDetails] = useState<MyDetails>(empty);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const next = await getMyDetails();
    setDetails(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void getMyDetails().then((next) => {
      if (!active) return;
      setDetails(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  return { details, loading, reload };
}
