import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceMembersState } from '@/auth/states/currentWorkspaceMembersState';
import { getToastOptionsFromError } from '@/error-handler/utils/getToastOptionsFromError';
import { OnboardingProfilePictureUploader } from '@/onboarding/components/OnboardingProfilePictureUploader';
import { OnboardingRewardMainButton } from '@/onboarding/components/OnboardingRewardMainButton';
import { OnboardingStepAnimatedItem } from '@/onboarding/components/OnboardingStepAnimatedItem';
import { StyledOnboardingStepHeading } from '@/onboarding/components/StyledOnboardingStepHeading';
import { StyledOnboardingStepPage } from '@/onboarding/components/StyledOnboardingStepPage';
import { StyledOnboardingStepSubtitle } from '@/onboarding/components/StyledOnboardingStepSubtitle';
import { StyledOnboardingStepTitle } from '@/onboarding/components/StyledOnboardingStepTitle';
import { ONBOARDING_CONTENT_BLOCK_WIDTH } from '@/onboarding/constants/OnboardingContentBlockWidth';
import { usePrefetchInviteSuggestions } from '@/onboarding/hooks/usePrefetchInviteSuggestions';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { useSetOnboardingStepFreeCredits } from '@/onboarding/hooks/useSetOnboardingStepFreeCredits';
import { onboardingCreateProfileDraftState } from '@/onboarding/states/onboardingCreateProfileDraftState';
import { onboardingCreditsProgressSelector } from '@/onboarding/states/selectors/onboardingCreditsProgressSelector';
import { useUpdateWorkspaceMemberSettings } from '@/workspace-member/hooks/useUpdateWorkspaceMemberSettings';
import { PageFocusId } from '@/types/PageFocusId';
import { TextInput } from '@/ui/input/components/TextInput';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { zodResolver } from '@hookform/resolvers/zod';
import { styled } from '@linaria/react';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useStore } from 'jotai';
import healthcareImage from '@/assets/healthcare.jpg';
import manufacturingImage from '@/assets/image-10.png';
import realestateImage from '@/assets/realestate.png';
import carsImage from '@/assets/images.png';
import { useCallback, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { Key } from 'ts-key-enum';
import { isDefined } from 'twenty-shared/utils';
import { doNotTranslate } from 'twenty-shared/i18n';
import { useToast } from 'twenty-ui/components/feedback';
import { MOBILE_VIEWPORT, themeCssVariables } from 'twenty-ui/theme';
import { z } from 'zod';

const StyledCardsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[4]};
  max-width: 100%;
  width: 100%;
`;

const StyledCardsLabel = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledCardsGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: repeat(2, 1fr);
  width: 100%;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    grid-template-columns: 1fr;
  }
`;

const StyledIndustryCard = styled.div<{ isSelected?: boolean }>`
  align-items: center;
  background-color: ${({ isSelected }) =>
    isSelected
      ? themeCssVariables.background.secondary
      : themeCssVariables.background.primary};
  border: ${({ isSelected }) =>
    isSelected
      ? `2px solid ${themeCssVariables.color.blue}`
      : `1px solid ${themeCssVariables.border.color.medium}`};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${({ isSelected }) =>
    isSelected
      ? '0 0 0 3px rgba(37, 99, 235, 0.15)'
      : '0 2px 8px rgba(0, 0, 0, 0.04)'};
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: flex-start;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
  transition: all 0.15s ease-in-out;
  user-select: none;

  &:hover {
    border-color: ${({ isSelected }) =>
      isSelected
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.strong};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

const StyledCardImage = styled.img`
  border-radius: ${themeCssVariables.border.radius.sm};
  height: 48px;
  max-height: 48px;
  max-width: 48px;
  object-fit: cover;
  width: 48px;
`;

const StyledCardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledCardTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledCardSubtitle = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledModulesPreview = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledModulesList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledModuleBadge = styled.span`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.rounded};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xs};
  padding: 2px 8px;
`;

const INDUSTRY_CARDS = [
  {
    id: 'manufacturing',
    title: 'Manufacturing CRM',
    description: 'Products, Production Orders, Raw Materials, Suppliers, Inventory, and Quality Control.',
    image: manufacturingImage,
  },
  {
    id: 'healthcare',
    title: 'Healthcare CRM',
    description: 'Patients, Appointments, Doctors, Departments, Follow-ups, and Reports.',
    image: healthcareImage,
  },
  {
    id: 'realestate',
    title: 'Real Estate CRM',
    description: 'Property Listings, Buyers & Leads, Site Visits, Deals, Follow-ups, and Reports.',
    image: realestateImage,
  },
  {
    id: 'others',
    title: 'Others',
    description: 'Lead, Opportunity, Contact, Company, and Task.',
    image: carsImage,
  },
];

const StyledForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[8]};
  max-width: 100%;
  padding-bottom: ${themeCssVariables.spacing[4]};
  width: ${ONBOARDING_CONTENT_BLOCK_WIDTH}px;
`;

const StyledNameRow = styled.div`
  align-items: flex-end;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  width: 100%;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const StyledNameField = styled.div`
  flex: 1 1 0;
  min-width: 0;
`;

const StyledButtonContainer = styled.div`
  display: flex;
  margin-top: ${themeCssVariables.spacing[6]};
  max-width: 100%;
  width: ${ONBOARDING_CONTENT_BLOCK_WIDTH}px;
`;

const firstNameErrorMessage = msg`First name can not be empty`;
const lastNameErrorMessage = msg`Last name can not be empty`;

const validationSchema = z.object({
  firstName: z.string().min(1, {
    error: i18n._(firstNameErrorMessage),
  }),
  lastName: z.string().min(1, {
    error: i18n._(lastNameErrorMessage),
  }),
  jobTitle: z.string(),
});

type Form = z.infer<typeof validationSchema>;

export const CreateProfile = () => {
  const { t } = useLingui();
  const setNextOnboardingStatus = useSetNextOnboardingStatus();
  const setOnboardingStepFreeCredits = useSetOnboardingStepFreeCredits();

  usePrefetchInviteSuggestions();

  const { enqueueToast } = useToast();
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const store = useStore();
  const onboardingCreditsProgress = useAtomStateValue(
    onboardingCreditsProgressSelector,
  );
  const setOnboardingCreateProfileDraft = useSetAtomState(
    onboardingCreateProfileDraftState,
  );
  const [initialCreateProfileDraft] = useState(() =>
    store.get(onboardingCreateProfileDraftState.atom),
  );
  const setCurrentUser = useSetAtomState(currentUserState);
  const setCurrentWorkspaceMembers = useSetAtomState(
    currentWorkspaceMembersState,
  );
  const { updateWorkspaceMemberSettings } = useUpdateWorkspaceMemberSettings();

  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { isValid, isSubmitting },
  } = useForm<Form>({
    mode: 'onChange',
    defaultValues: {
      firstName:
        initialCreateProfileDraft?.firstName ??
        currentWorkspaceMember?.name?.firstName ??
        '',
      lastName:
        initialCreateProfileDraft?.lastName ??
        currentWorkspaceMember?.name?.lastName ??
        '',
      jobTitle: currentWorkspaceMember?.jobTitle ?? '',
    },
    resolver: zodResolver(validationSchema),
  });

  const setCreateProfileDraftFromForm = () =>
    setOnboardingCreateProfileDraft({
      firstName: getValues('firstName'),
      lastName: getValues('lastName'),
    });

  const onSubmit: SubmitHandler<Form> = useCallback(
    async (data) => {
      try {
        if (!currentWorkspaceMember?.id) {
          throw new Error(doNotTranslate('User is not logged in'));
        }
        if (!data.firstName || !data.lastName) {
          throw new Error(doNotTranslate('First name or last name is missing'));
        }

        await updateWorkspaceMemberSettings({
          workspaceMemberId: currentWorkspaceMember.id,
          update: {
            name: {
              firstName: data.firstName,
              lastName: data.lastName,
            },
            jobTitle: data.jobTitle,
            colorScheme: doNotTranslate('System'),
          },
        });

        setCurrentWorkspaceMembers((members) =>
          members.map((member) =>
            member.id === currentWorkspaceMember?.id
              ? {
                  ...member,
                  name: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                  },
                  jobTitle: data.jobTitle,
                  colorScheme: doNotTranslate('System'),
                }
              : member,
          ),
        );

        setCurrentUser((current) => {
          if (isDefined(current)) {
            return {
              ...current,
              firstName: data.firstName,
              lastName: data.lastName,
            };
          }
          return current;
        });

        if (selectedIndustry) {
          try {
            await fetch('/api/industry-template', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                industry: selectedIndustry,
                workspaceId: currentWorkspaceMember?.workspaceId,
              }),
            });
          } catch (e) {
            console.error('Failed to apply industry template', e);
          }
        }

        setOnboardingStepFreeCredits(
          'createProfile',
          store.get(onboardingCreditsProgressSelector.atom).rewardCreditsByStep
            .createProfile,
        );
        setNextOnboardingStatus({ stepHistoryEffect: 'recordAsReversible' });
        setIsNavigating(true);
      } catch (error: any) {
        setIsNavigating(false);
        enqueueToast(getToastOptionsFromError({ error }));
      }
    },
    [
      currentWorkspaceMember?.id,
      currentWorkspaceMember?.workspaceId,
      selectedIndustry,
      store,
      setNextOnboardingStatus,
      setOnboardingStepFreeCredits,
      enqueueToast,
      setCurrentWorkspaceMembers,
      setCurrentUser,
      updateWorkspaceMemberSettings,
    ],
  );

  const [isEditingMode, setIsEditingMode] = useState(false);

  const handleEnter = () => {
    if (isEditingMode && isDefined(selectedIndustry)) {
      handleSubmit(onSubmit)();
    }
  };

  useHotkeysOnFocusedElement({
    keys: Key.Enter,
    callback: handleEnter,
    focusId: PageFocusId.CreateProfile,
    dependencies: [handleEnter],
  });

  return (
    <StyledOnboardingStepPage data-testid="onboarding-create-profile-step">
      <StyledOnboardingStepHeading>
        <OnboardingStepAnimatedItem index={0}>
          <StyledOnboardingStepTitle>{t`Create profile`}</StyledOnboardingStepTitle>
        </OnboardingStepAnimatedItem>
        <OnboardingStepAnimatedItem index={1}>
          <StyledOnboardingStepSubtitle>
            {t`How you'll appear to teammates and agents.`}
          </StyledOnboardingStepSubtitle>
        </OnboardingStepAnimatedItem>
      </StyledOnboardingStepHeading>

      <OnboardingStepAnimatedItem index={2}>
        <StyledForm>
          <StyledNameRow>
            {isDefined(currentWorkspaceMember?.id) && (
              <OnboardingProfilePictureUploader
                workspaceMemberId={currentWorkspaceMember.id}
              />
            )}
            <StyledNameField>
              <Controller
                name="firstName"
                control={control}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { error },
                }) => (
                  <TextInput
                    autoFocus
                    label={t`First Name`}
                    value={value}
                    onFocus={() => setIsEditingMode(true)}
                    onBlur={() => {
                      onBlur();
                      setIsEditingMode(false);
                    }}
                    onChange={(firstName) => {
                      onChange(firstName);
                      setCreateProfileDraftFromForm();
                    }}
                    placeholder={t`Tim`}
                    error={error?.message}
                    fullWidth
                  />
                )}
              />
            </StyledNameField>
            <StyledNameField>
              <Controller
                name="lastName"
                control={control}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { error },
                }) => (
                  <TextInput
                    label={t`Last name`}
                    value={value}
                    onFocus={() => setIsEditingMode(true)}
                    onBlur={() => {
                      onBlur();
                      setIsEditingMode(false);
                    }}
                    onChange={(lastName) => {
                      onChange(lastName);
                      setCreateProfileDraftFromForm();
                    }}
                    placeholder={t`Apple`}
                    error={error?.message}
                    fullWidth
                  />
                )}
              />
            </StyledNameField>
          </StyledNameRow>
          <Controller
            name="jobTitle"
            control={control}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label={t`Job Title`}
                value={value}
                onFocus={() => setIsEditingMode(true)}
                onBlur={() => {
                  onBlur();
                  setIsEditingMode(false);
                }}
                onChange={onChange}
                placeholder={t`Head of Partnerships`}
                fullWidth
              />
            )}
          />

          <StyledCardsSection>
            <StyledCardsLabel>{t`Workspace Template`}</StyledCardsLabel>
            <StyledCardsGrid>
              {INDUSTRY_CARDS.map((card) => (
                <StyledIndustryCard
                  key={card.id}
                  isSelected={selectedIndustry === card.id}
                  onClick={() =>
                    setSelectedIndustry(
                      selectedIndustry === card.id ? null : card.id,
                    )
                  }
                >
                  <StyledCardImage src={card.image} alt={card.title} />
                  <StyledCardContent>
                    <StyledCardTitle>{card.title}</StyledCardTitle>
                    <StyledCardSubtitle>{card.description}</StyledCardSubtitle>
                  </StyledCardContent>
                </StyledIndustryCard>
              ))}
            </StyledCardsGrid>

            {selectedIndustry === 'manufacturing' && (
              <StyledModulesPreview>
                <StyledCardsLabel>{t`Enabled Manufacturing Modules`}</StyledCardsLabel>
                <StyledModulesList>
                  <StyledModuleBadge>{t`Products`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Production Orders`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Raw Materials`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Suppliers`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Inventory`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Quality Control`}</StyledModuleBadge>
                </StyledModulesList>
                <StyledCardsLabel style={{ marginTop: '6px' }}>{t`Configured Pipelines`}</StyledCardsLabel>
                <StyledModulesList>
                  <StyledModuleBadge>{t`Production Workflow Pipeline`}</StyledModuleBadge>
                </StyledModulesList>
              </StyledModulesPreview>
            )}

            {selectedIndustry === 'healthcare' && (
              <StyledModulesPreview>
                <StyledCardsLabel>{t`Enabled Healthcare Modules`}</StyledCardsLabel>
                <StyledModulesList>
                  <StyledModuleBadge>{t`Patients`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Appointments`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Doctors`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Departments`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Follow-ups`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Reports`}</StyledModuleBadge>
                </StyledModulesList>
                <StyledCardsLabel style={{ marginTop: '6px' }}>{t`Configured Pipelines`}</StyledCardsLabel>
                <StyledModulesList>
                  <StyledModuleBadge>{t`Patient Acquisition Pipeline`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Appointment Management Pipeline`}</StyledModuleBadge>
                </StyledModulesList>
              </StyledModulesPreview>
            )}

            {selectedIndustry === 'realestate' && (
              <StyledModulesPreview>
                <StyledCardsLabel>{t`Enabled Real Estate Modules`}</StyledCardsLabel>
                <StyledModulesList>
                  <StyledModuleBadge>{t`Property Listings`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Buyers & Leads`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Site Visits`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Deals`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Follow-ups`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Reports`}</StyledModuleBadge>
                </StyledModulesList>
                <StyledCardsLabel style={{ marginTop: '6px' }}>{t`Configured Pipelines`}</StyledCardsLabel>
                <StyledModulesList>
                  <StyledModuleBadge>{t`Deal Pipeline: New Deal → Negotiation → Documentation → Closed Won / Closed Lost`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Lead Pipeline: New Lead → Qualified → Site Visit → Negotiation → Converted / Lost`}</StyledModuleBadge>
                </StyledModulesList>
              </StyledModulesPreview>
            )}

            {selectedIndustry === 'others' && (
              <StyledModulesPreview>
                <StyledCardsLabel>{t`Enabled Others Modules`}</StyledCardsLabel>
                <StyledModulesList>
                  <StyledModuleBadge>{t`Lead`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Opportunity`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Contact`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Company`}</StyledModuleBadge>
                  <StyledModuleBadge>{t`Task`}</StyledModuleBadge>
                </StyledModulesList>
                <StyledCardsLabel style={{ marginTop: '6px' }}>{t`Configured Pipelines`}</StyledCardsLabel>
                <StyledModulesList>
                  <StyledModuleBadge>{t`Standard Sales Pipeline`}</StyledModuleBadge>
                </StyledModulesList>
              </StyledModulesPreview>
            )}
          </StyledCardsSection>
        </StyledForm>
      </OnboardingStepAnimatedItem>

      <OnboardingStepAnimatedItem index={3}>
        <StyledButtonContainer>
          <OnboardingRewardMainButton
            label={t`Continue`}
            creditsReward={
              onboardingCreditsProgress.rewardCreditsByStep.createProfile
            }
            disabled={!isValid || !selectedIndustry || isSubmitting || isNavigating}
            onClick={handleSubmit(onSubmit)}
          />
        </StyledButtonContainer>
      </OnboardingStepAnimatedItem>
    </StyledOnboardingStepPage>
  );
};
