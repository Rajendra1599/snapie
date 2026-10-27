import mongoose, { Schema, Document } from 'mongoose';

// ==================== User ====================
export interface IUser extends Document {
  userId: string; // client UUID / anonymous device ID
  createdAt: Date;
  ageConfirmedAt?: Date;
  consentVersion?: string;
  locale: string;
  timezone: string;
  deletedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    ageConfirmedAt: { type: Date },
    consentVersion: { type: String },
    locale: { type: String, default: 'en_IN' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    deletedAt: { type: Date },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// ==================== Look ====================
export interface ILook extends Document {
  id?: string;
  lookId?: string;
  name: string;
  kind: 'effect' | 'template';
  description?: string;
  tier?: 'free' | 'plus' | 'gold';
  creditCost?: number;
  order?: number;
  active?: boolean;
  pipelineA?: any;
  pipelineB?: any;
  preview?: any;
  updatedAt?: Date;
}

const LookSchema = new Schema<ILook>(
  {
    id: { type: String, index: true },
    lookId: { type: String, index: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['effect', 'template'], default: 'effect' },
    description: { type: String, default: '' },
    tier: { type: String, enum: ['free', 'plus', 'gold'], default: 'free' },
    creditCost: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, strict: false }
);

// ==================== Generation ====================
export interface IGeneration extends Document {
  generationId: string;
  userId: string;
  lookId: string;
  strength: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'rejected';
  inputKey: string;
  outputKey?: string;
  errorCode?: string;
  idempotencyKey: string;
  createdAt: Date;
  completedAt?: Date;
}

const GenerationSchema = new Schema<IGeneration>(
  {
    generationId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    lookId: { type: String, required: true },
    strength: { type: Number, default: 80 },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'rejected'],
      default: 'queued',
      index: true,
    },
    inputKey: { type: String, required: true },
    outputKey: { type: String },
    errorCode: { type: String },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    completedAt: { type: Date },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// ==================== Credit Ledger (Append-Only) ====================
export interface ICreditLedger extends Document {
  ledgerId: string;
  userId: string;
  delta: number; // positive for purchases/grants, negative for generations
  reason: 'initial_grant' | 'generation_reserve' | 'generation_refund' | 'store_purchase' | 'subscription_daily';
  generationId?: string;
  storeTransactionId?: string;
  createdAt: Date;
}

const CreditLedgerSchema = new Schema<ICreditLedger>(
  {
    ledgerId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    delta: { type: Number, required: true },
    reason: {
      type: String,
      enum: [
        'initial_grant',
        'generation_reserve',
        'generation_refund',
        'store_purchase',
        'subscription_daily',
      ],
      required: true,
    },
    generationId: { type: String, index: true },
    storeTransactionId: { type: String },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// ==================== Purchase ====================
export interface IPurchase extends Document {
  purchaseId: string;
  userId: string;
  store: 'google_play' | 'app_store';
  productId: string;
  transactionId: string;
  status: 'active' | 'expired' | 'refunded';
  createdAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>(
  {
    purchaseId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    store: { type: String, enum: ['google_play', 'app_store'], required: true },
    productId: { type: String, required: true },
    transactionId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['active', 'expired', 'refunded'], default: 'active' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// ==================== Report ====================
export interface IReport extends Document {
  reportId: string;
  userId: string;
  generationId: string;
  reason: string;
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reportId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    generationId: { type: String, required: true, index: true },
    reason: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// ==================== Onboarding Slide ====================
export interface IOnboardingSlide extends Document {
  id: string;
  title: string;
  subtitle: string;
  before_url: string;
  after_url: string;
  filter: number[];
  order: number;
}

const OnboardingSlideSchema = new Schema<IOnboardingSlide>(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    before_url: { type: String, default: '' },
    after_url: { type: String, default: '' },
    filter: { type: [Number], default: [] },
    order: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// ==================== Hero Config ====================
export interface IHeroConfig extends Document {
  key: string;
  picture1_url: string;
  picture2_url: string;
  title: string;
  subtitle: string;
  button_text: string;
}

const HeroConfigSchema = new Schema<IHeroConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    picture1_url: { type: String, default: '' },
    picture2_url: { type: String, default: '' },
    title: { type: String, default: 'aesthetic\nfilters' },
    subtitle: { type: String, default: 'Film looks and pro adjustments, free on any photo.' },
    button_text: { type: String, default: 'SELECT A PHOTO' },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
export const Look = mongoose.model<ILook>('Look', LookSchema);
export const Generation = mongoose.model<IGeneration>('Generation', GenerationSchema);
export const CreditLedger = mongoose.model<ICreditLedger>('CreditLedger', CreditLedgerSchema);
export const Purchase = mongoose.model<IPurchase>('Purchase', PurchaseSchema);
export const Report = mongoose.model<IReport>('Report', ReportSchema);
export const OnboardingSlide = mongoose.model<IOnboardingSlide>('OnboardingSlide', OnboardingSlideSchema);
export const HeroConfig = mongoose.model<IHeroConfig>('HeroConfig', HeroConfigSchema);

