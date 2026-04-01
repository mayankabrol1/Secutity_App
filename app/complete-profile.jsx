import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";

import AppButton from "../components/UI/AppButton";
import AppInput from "../components/UI/AppInput";
import AppKeyboardView from "../components/UI/AppKeyboardView";
import AppSelect from "../components/UI/AppSelect";
import { useAppState } from "../lib/app-state";
import { validateProfilePayload } from "../lib/profile-validation";

export const COUNTRY_OPTIONS = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
].map((country) => ({ label: country, value: country }));

export const COUNTRY_CODE_OPTIONS = [
  { label: "CA/US (+1)", value: "+1" },
  { label: "United Kingdom (+44)", value: "+44" },
  { label: "India (+91)", value: "+91" },
  { label: "Australia (+61)", value: "+61" },
  { label: "Germany (+49)", value: "+49" },
  { label: "France (+33)", value: "+33" },
  { label: "Spain (+34)", value: "+34" },
  { label: "Italy (+39)", value: "+39" },
  { label: "Netherlands (+31)", value: "+31" },
  { label: "Sweden (+46)", value: "+46" },
  { label: "Norway (+47)", value: "+47" },
  { label: "Denmark (+45)", value: "+45" },
  { label: "Switzerland (+41)", value: "+41" },
  { label: "Ireland (+353)", value: "+353" },
  { label: "Portugal (+351)", value: "+351" },
  { label: "Mexico (+52)", value: "+52" },
  { label: "Brazil (+55)", value: "+55" },
  { label: "Argentina (+54)", value: "+54" },
  { label: "Chile (+56)", value: "+56" },
  { label: "Colombia (+57)", value: "+57" },
  { label: "Peru (+51)", value: "+51" },
  { label: "South Africa (+27)", value: "+27" },
  { label: "Egypt (+20)", value: "+20" },
  { label: "Nigeria (+234)", value: "+234" },
  { label: "Kenya (+254)", value: "+254" },
  { label: "UAE (+971)", value: "+971" },
  { label: "Saudi Arabia (+966)", value: "+966" },
  { label: "Qatar (+974)", value: "+974" },
  { label: "Turkey (+90)", value: "+90" },
  { label: "Israel (+972)", value: "+972" },
  { label: "Pakistan (+92)", value: "+92" },
  { label: "Bangladesh (+880)", value: "+880" },
  { label: "Sri Lanka (+94)", value: "+94" },
  { label: "Nepal (+977)", value: "+977" },
  { label: "China (+86)", value: "+86" },
  { label: "Japan (+81)", value: "+81" },
  { label: "South Korea (+82)", value: "+82" },
  { label: "Singapore (+65)", value: "+65" },
  { label: "Malaysia (+60)", value: "+60" },
  { label: "Thailand (+66)", value: "+66" },
  { label: "Indonesia (+62)", value: "+62" },
  { label: "Philippines (+63)", value: "+63" },
  { label: "Vietnam (+84)", value: "+84" },
  { label: "New Zealand (+64)", value: "+64" },
];
export default function CompleteProfileScreen() {
  const router = useRouter();
  const { currentUser, completeProfile, logout } = useAppState();
  const [phoneCode, setPhoneCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const allowedCountryCodes = useMemo(() => new Set(COUNTRY_CODE_OPTIONS.map((option) => option.value)), []);
  const allowedCountries = useMemo(() => new Set(COUNTRY_OPTIONS.map((option) => option.value)), []);

  if (!currentUser) return <Redirect href="/login" />;
  if (currentUser.profileComplete) return <Redirect href="/movies" />;

  async function onSaveProfile() {
    const cleanPhoneNumber = phoneNumber.trim();
    const cleanPhoneCode = phoneCode.trim();
    const cleanPhone = `${cleanPhoneCode} ${cleanPhoneNumber}`.trim();
    const cleanCountry = country.trim();
    const validationError = validateProfilePayload({
      phoneCode: cleanPhoneCode,
      phoneNumber: cleanPhoneNumber,
      country: cleanCountry,
      allowedCodes: allowedCountryCodes,
      allowedCountries,
    });
    if (validationError) {
      Alert.alert("Invalid details", validationError);
      return;
    }

    setSaving(true);
    try {
      await completeProfile({ phone: cleanPhone, country: cleanCountry });
      router.replace("/movies");
    } catch (error) {
      Alert.alert("Could not save profile", error?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppKeyboardView className="bg-white px-6 justify-center">
        <Text className="text-3xl font-bold text-gray-900">Complete your profile</Text>
        <Text className="text-gray-600 mt-2 mb-8">
          Add your phone number and country to finish setting up your account.
        </Text>

        <Text className="text-gray-700 font-medium mb-2">Phone</Text>
        <View className="flex-row items-center gap-2 mb-3">
          <AppSelect
            className="w-40"
            modalTitle="Select Country Code"
            value={phoneCode}
            options={COUNTRY_CODE_OPTIONS}
            placeholder="Code"
            onChange={setPhoneCode}
            sheetHeightRatio={0.65}
          />
          <AppInput
            className="flex-1 mb-0"
            placeholder="Enter phone number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>

        <Text className="text-gray-700 font-medium mb-2">Country</Text>
        <AppSelect
          className="mb-3"
          modalTitle="Select Country"
          value={country}
          options={COUNTRY_OPTIONS}
          placeholder="Select your country"
          onChange={setCountry}
          sheetHeightRatio={0.65}
        />

        <AppButton className="bg-cyan-500 border-cyan-500" onPress={onSaveProfile} disabled={saving}>
          {saving ? "Saving..." : "Continue"}
        </AppButton>

        <AppButton
          variant="secondary"
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          Back
        </AppButton>
    </AppKeyboardView>
  );
}
