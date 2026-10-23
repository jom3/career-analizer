-- CreateIndex
CREATE INDEX "AdaptedCv_userId_idx" ON "AdaptedCv"("userId");

-- CreateIndex
CREATE INDEX "Certification_profileId_idx" ON "Certification"("profileId");

-- CreateIndex
CREATE INDEX "CoverLetter_userId_idx" ON "CoverLetter"("userId");

-- CreateIndex
CREATE INDEX "CvDocument_userId_idx" ON "CvDocument"("userId");

-- CreateIndex
CREATE INDEX "Education_profileId_idx" ON "Education"("profileId");

-- CreateIndex
CREATE INDEX "Experience_profileId_idx" ON "Experience"("profileId");

-- CreateIndex
CREATE INDEX "JobMatch_userId_idx" ON "JobMatch"("userId");

-- CreateIndex
CREATE INDEX "JobOffer_userId_idx" ON "JobOffer"("userId");

-- CreateIndex
CREATE INDEX "Language_profileId_idx" ON "Language"("profileId");

-- CreateIndex
CREATE INDEX "Project_profileId_idx" ON "Project"("profileId");

-- CreateIndex
CREATE INDEX "Skill_profileId_idx" ON "Skill"("profileId");
