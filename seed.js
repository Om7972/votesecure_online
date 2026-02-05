const bcrypt = require('bcryptjs');
const { User, Election, Candidate, Vote, sequelize } = require('./models');

async function seedDatabase() {
    try {
        console.log('Syncing database...');
        await sequelize.sync({ force: false });
        console.log('Starting database seeding...');

        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        const [admin, adminCreated] = await User.findOrCreate({
            where: { email: 'admin@votesecure.com' },
            defaults: {
                name: 'Admin User',
                email: 'admin@votesecure.com',
                password_hash: adminPassword,
                role: 'admin',
                is_verified: true,
                phone: '+1234567890'
            }
        });
        console.log(adminCreated ? '✅ Admin user created' : 'ℹ️  Admin user already exists');

        // Create sample voters
        const voterPassword = await bcrypt.hash('voter123', 10);
        const [voter1, voter1Created] = await User.findOrCreate({
            where: { email: 'john.doe@email.com' },
            defaults: {
                name: 'John Doe',
                email: 'john.doe@email.com',
                password_hash: voterPassword,
                role: 'voter',
                is_verified: true,
                phone: '+1234567891'
            }
        });
        console.log(voter1Created ? '✅ Voter 1 created' : 'ℹ️  Voter 1 already exists');

        // =============================================
        // ACTIVE ELECTIONS
        // =============================================

        // FEDERAL - Active
        const [federalElection1, fedCreated1] = await Election.findOrCreate({
            where: { title: 'Presidential Primary Election 2026' },
            defaults: {
                title: 'Presidential Primary Election 2026',
                description: 'Cast your vote for the presidential primary candidates. Federal election with nationwide participation.',
                start_time: new Date('2025-01-01'),
                end_time: new Date('2026-12-31'),
                status: 'active',
                created_by: admin.id
            }
        });
        if (fedCreated1) {
            await Candidate.bulkCreate([
                { name: 'Alexander Hamilton', party: 'Democratic Party', manifesto: 'Unity and progress for all Americans', image_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a', election_id: federalElection1.id, vote_count: 2340 },
                { name: 'Benjamin Franklin', party: 'Republican Party', manifesto: 'Economic growth and fiscal responsibility', image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', election_id: federalElection1.id, vote_count: 1890 },
                { name: 'Thomas Jefferson', party: 'Independent', manifesto: 'Liberty and individual freedoms', image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', election_id: federalElection1.id, vote_count: 1456 }
            ]);
        }
        console.log(fedCreated1 ? '✅ Federal Election 1 created' : 'ℹ️  Federal Election 1 already exists');

        // STATE - Active
        const [stateElection1, stateCreated1] = await Election.findOrCreate({
            where: { title: 'State Governor Election 2026' },
            defaults: {
                title: 'State Governor Election 2026',
                description: 'Elect the next state governor to lead our state forward. State-level election.',
                start_time: new Date('2025-06-01'),
                end_time: new Date('2026-12-31'),
                status: 'active',
                created_by: admin.id
            }
        });
        if (stateCreated1) {
            await Candidate.bulkCreate([
                { name: 'Jennifer Adams', party: 'Democratic Party', manifesto: 'Healthcare and education reform', image_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2', election_id: stateElection1.id, vote_count: 1567 },
                { name: 'Michael Rodriguez', party: 'Republican Party', manifesto: 'Lower taxes and business growth', image_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7', election_id: stateElection1.id, vote_count: 1234 },
                { name: 'Emily Wong', party: 'Green Party', manifesto: 'Environmental sustainability', image_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956', election_id: stateElection1.id, vote_count: 890 }
            ]);
        }
        console.log(stateCreated1 ? '✅ State Election 1 created' : 'ℹ️  State Election 1 already exists');

        // LOCAL - Active (City Council)
        const [localElection1, localCreated1] = await Election.findOrCreate({
            where: { title: '2024 City Council Election' },
            defaults: {
                title: '2024 City Council Election',
                description: 'Elect representatives for the city council to serve a 4-year term. Local community election.',
                start_time: new Date('2024-01-01'),
                end_time: new Date('2026-12-31'),
                status: 'active',
                created_by: admin.id
            }
        });
        if (localCreated1) {
            await Candidate.bulkCreate([
                { name: 'Sarah Johnson', party: 'Democratic Party', manifesto: 'Focus on education and infrastructure development', image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', election_id: localElection1.id, vote_count: 890 },
                { name: 'Mike Davis', party: 'Republican Party', manifesto: 'Economic growth and job creation', image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', election_id: localElection1.id, vote_count: 756 },
                { name: 'Emily Chen', party: 'Independent', manifesto: 'Environmental sustainability and green initiatives', image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80', election_id: localElection1.id, vote_count: 623 },
                { name: 'Robert Williams', party: 'Green Party', manifesto: 'Community engagement and social programs', image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', election_id: localElection1.id, vote_count: 445 }
            ]);
        }
        console.log(localCreated1 ? '✅ Local Election 1 created' : 'ℹ️  Local Election 1 already exists');

        // LOCAL - Active (School Board)
        const [localElection2, localCreated2] = await Election.findOrCreate({
            where: { title: 'School Board Election 2024' },
            defaults: {
                title: 'School Board Election 2024',
                description: 'Choose board members to oversee educational policies and budget allocation. Local education election.',
                start_time: new Date('2024-03-01'),
                end_time: new Date('2026-12-31'),
                status: 'active',
                created_by: admin.id
            }
        });
        if (localCreated2) {
            await Candidate.bulkCreate([
                { name: 'Dr. Amanda Martinez', party: 'Education First', manifesto: 'Increase teacher salaries and modernize curriculum', image_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2', election_id: localElection2.id, vote_count: 567 },
                { name: 'James Thompson', party: 'Parents Coalition', manifesto: 'Focus on STEM education and extracurricular activities', image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', election_id: localElection2.id, vote_count: 432 },
                { name: 'Lisa Anderson', party: 'Independent', manifesto: 'Mental health support and inclusive education', image_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956', election_id: localElection2.id, vote_count: 345 }
            ]);
        }
        console.log(localCreated2 ? '✅ Local Election 2 created' : 'ℹ️  Local Election 2 already exists');

        // =============================================
        // UPCOMING ELECTIONS
        // =============================================

        // FEDERAL - Upcoming
        const [federalUpcoming1, fedUpCreated1] = await Election.findOrCreate({
            where: { title: 'Congressional Elections 2027' },
            defaults: {
                title: 'Congressional Elections 2027',
                description: 'Elect your congressional representatives for the next term. Federal level election.',
                start_time: new Date('2027-01-15'),
                end_time: new Date('2027-02-15'),
                status: 'upcoming',
                created_by: admin.id
            }
        });
        if (fedUpCreated1) {
            await Candidate.bulkCreate([
                { name: 'David Martinez', party: 'Democratic Party', manifesto: 'Healthcare reform and worker rights', image_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a', election_id: federalUpcoming1.id, vote_count: 0 },
                { name: 'Rebecca Stone', party: 'Republican Party', manifesto: 'National security and economic freedom', image_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2', election_id: federalUpcoming1.id, vote_count: 0 }
            ]);
        }
        console.log(fedUpCreated1 ? '✅ Federal Upcoming Election created' : 'ℹ️  Federal Upcoming Election already exists');

        // STATE - Upcoming
        const [stateUpcoming1, stateUpCreated1] = await Election.findOrCreate({
            where: { title: 'State Senate Elections 2027' },
            defaults: {
                title: 'State Senate Elections 2027',
                description: 'Vote for state senate candidates. State level election.',
                start_time: new Date('2027-02-01'),
                end_time: new Date('2027-02-28'),
                status: 'upcoming',
                created_by: admin.id
            }
        });
        if (stateUpCreated1) {
            await Candidate.bulkCreate([
                { name: 'Patricia Lee', party: 'Democratic Party', manifesto: 'Education and infrastructure investment', image_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956', election_id: stateUpcoming1.id, vote_count: 0 },
                { name: 'Robert Chen', party: 'Republican Party', manifesto: 'Fiscal responsibility and tax cuts', image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', election_id: stateUpcoming1.id, vote_count: 0 }
            ]);
        }
        console.log(stateUpCreated1 ? '✅ State Upcoming Election created' : 'ℹ️  State Upcoming Election already exists');

        // LOCAL - Upcoming (Community Budget)
        const [localUpcoming1, localUpCreated1] = await Election.findOrCreate({
            where: { title: 'Community Budget Referendum' },
            defaults: {
                title: 'Community Budget Referendum',
                description: 'Vote on the proposed $2.5M budget allocation for community development projects. Local referendum.',
                start_time: new Date('2027-01-01'),
                end_time: new Date('2027-01-31'),
                status: 'upcoming',
                created_by: admin.id
            }
        });
        if (localUpCreated1) {
            await Candidate.bulkCreate([
                { name: 'YES - Approve Budget', party: 'Proposal', manifesto: 'Support infrastructure improvements and community programs', image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40', election_id: localUpcoming1.id, vote_count: 0 },
                { name: 'NO - Reject Budget', party: 'Opposition', manifesto: 'Reduce spending and lower taxes', image_url: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85', election_id: localUpcoming1.id, vote_count: 0 }
            ]);
        }
        console.log(localUpCreated1 ? '✅ Local Upcoming Election created' : 'ℹ️  Local Upcoming Election already exists');

        // LOCAL - Upcoming (Library Committee)
        const [localUpcoming2, localUpCreated2] = await Election.findOrCreate({
            where: { title: 'Library Committee Election 2027' },
            defaults: {
                title: 'Library Committee Election 2027',
                description: 'Elect representatives for the public library committee. Local community election.',
                start_time: new Date('2027-03-01'),
                end_time: new Date('2027-03-31'),
                status: 'upcoming',
                created_by: admin.id
            }
        });
        if (localUpCreated2) {
            await Candidate.bulkCreate([
                { name: 'Margaret Wilson', party: 'Library Advocates', manifesto: 'Digital library expansion and youth programs', image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80', election_id: localUpcoming2.id, vote_count: 0 },
                { name: 'Daniel Brown', party: 'Community First', manifesto: 'Traditional library services and community events', image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', election_id: localUpcoming2.id, vote_count: 0 }
            ]);
        }
        console.log(localUpCreated2 ? '✅ Local Upcoming Election 2 created' : 'ℹ️  Local Upcoming Election 2 already exists');

        // =============================================
        // ENDED ELECTIONS (with vote counts)
        // =============================================

        // FEDERAL - Ended
        const [federalEnded1, fedEndCreated1] = await Election.findOrCreate({
            where: { title: 'Senate Elections 2024' },
            defaults: {
                title: 'Senate Elections 2024',
                description: 'Federal senate elections completed. Results have been finalized and certified.',
                start_time: new Date('2024-01-01'),
                end_time: new Date('2024-06-30'),
                status: 'ended',
                created_by: admin.id
            }
        });
        if (fedEndCreated1) {
            await Candidate.bulkCreate([
                { name: 'John Mitchell', party: 'Democratic Party', manifesto: 'Progressive policies and healthcare', image_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a', election_id: federalEnded1.id, vote_count: 1456 },
                { name: 'Susan Clark', party: 'Republican Party', manifesto: 'Economic stability and job growth', image_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2', election_id: federalEnded1.id, vote_count: 1234 },
                { name: 'None of the Above (NOTA)', party: 'NOTA', manifesto: 'Reject all candidates', image_url: 'https://images.unsplash.com/photo-1606189934846-a527add8a77b', election_id: federalEnded1.id, vote_count: 345 }
            ]);
        }
        console.log(fedEndCreated1 ? '✅ Federal Ended Election created' : 'ℹ️  Federal Ended Election already exists');

        // STATE - Ended
        const [stateEnded1, stateEndCreated1] = await Election.findOrCreate({
            where: { title: 'State Assembly Election 2024' },
            defaults: {
                title: 'State Assembly Election 2024',
                description: 'State assembly elections completed. Winners have been announced.',
                start_time: new Date('2024-02-01'),
                end_time: new Date('2024-05-31'),
                status: 'ended',
                created_by: admin.id
            }
        });
        if (stateEndCreated1) {
            await Candidate.bulkCreate([
                { name: 'Richard Taylor', party: 'Democratic Party', manifesto: 'State infrastructure and education', image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', election_id: stateEnded1.id, vote_count: 987 },
                { name: 'Nancy White', party: 'Republican Party', manifesto: 'Fiscal responsibility', image_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956', election_id: stateEnded1.id, vote_count: 876 },
                { name: 'None of the Above (NOTA)', party: 'NOTA', manifesto: 'Reject all candidates', image_url: 'https://images.unsplash.com/photo-1606189934846-a527add8a77b', election_id: stateEnded1.id, vote_count: 234 }
            ]);
        }
        console.log(stateEndCreated1 ? '✅ State Ended Election created' : 'ℹ️  State Ended Election already exists');

        // LOCAL - Ended (Mayor)
        const [localEnded1, localEndCreated1] = await Election.findOrCreate({
            where: { title: 'Mayor Election 2024' },
            defaults: {
                title: 'Mayor Election 2024',
                description: 'Elected the city mayor for the 2024-2028 term. Results certified.',
                start_time: new Date('2024-01-01'),
                end_time: new Date('2024-08-31'),
                status: 'ended',
                created_by: admin.id
            }
        });
        if (localEndCreated1) {
            await Candidate.bulkCreate([
                { name: 'Sarah Johnson', party: 'Democratic Party', manifesto: 'Progressive policies for city development', image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', election_id: localEnded1.id, vote_count: 2340 },
                { name: 'Mike Davis', party: 'Republican Party', manifesto: 'Conservative fiscal management', image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', election_id: localEnded1.id, vote_count: 1890 },
                { name: 'None of the Above (NOTA)', party: 'NOTA', manifesto: 'Reject all candidates', image_url: 'https://images.unsplash.com/photo-1606189934846-a527add8a77b', election_id: localEnded1.id, vote_count: 456 }
            ]);
        }
        console.log(localEndCreated1 ? '✅ Local Ended Election 1 created' : 'ℹ️  Local Ended Election 1 already exists');

        // LOCAL - Ended (Library Committee)
        const [localEnded2, localEndCreated2] = await Election.findOrCreate({
            where: { title: 'Library Committee Representative' },
            defaults: {
                title: 'Library Committee Representative',
                description: 'Past election for Library Committee Representative - view results and voting statistics.',
                start_time: new Date('2024-10-01'),
                end_time: new Date('2024-12-06'),
                status: 'ended',
                created_by: admin.id
            }
        });
        if (localEndCreated2) {
            await Candidate.bulkCreate([
                { name: 'Meera Nair', party: 'Student Welfare Union', manifesto: 'Modern library resources and extended hours', image_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2', election_id: localEnded2.id, vote_count: 190 },
                { name: 'Rahul Verma', party: 'Academic Reform Party', manifesto: 'Digital archives and study spaces', image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', election_id: localEnded2.id, vote_count: 100 },
                { name: 'Suresh Chandra', party: 'Progressive Students Coalition', manifesto: 'Inclusive programs and accessibility', image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e', election_id: localEnded2.id, vote_count: 56 },
                { name: 'None of the Above (NOTA)', party: 'NOTA', manifesto: 'Reject all candidates', image_url: 'https://images.unsplash.com/photo-1606189934846-a527add8a77b', election_id: localEnded2.id, vote_count: 100 }
            ]);
        }
        console.log(localEndCreated2 ? '✅ Local Ended Election 2 created' : 'ℹ️  Local Ended Election 2 already exists');

        // LOCAL - Ended (Student Council)
        const [localEnded3, localEndCreated3] = await Election.findOrCreate({
            where: { title: 'Student Council General Elections 2024' },
            defaults: {
                title: 'Student Council General Elections 2024',
                description: "Previous year's general elections for student council positions. Results finalized and published.",
                start_time: new Date('2024-09-01'),
                end_time: new Date('2024-11-30'),
                status: 'ended',
                created_by: admin.id
            }
        });
        if (localEndCreated3) {
            await Candidate.bulkCreate([
                { name: 'Priya Sharma', party: 'Student Unity', manifesto: 'Campus safety and student services', image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', election_id: localEnded3.id, vote_count: 456 },
                { name: 'Arun Kumar', party: 'Progressive Alliance', manifesto: 'Academic reform and fair grading', image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d', election_id: localEnded3.id, vote_count: 389 },
                { name: 'Deepa Menon', party: 'Independent', manifesto: 'Mental health and wellness programs', image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80', election_id: localEnded3.id, vote_count: 234 },
                { name: 'None of the Above (NOTA)', party: 'NOTA', manifesto: 'Reject all candidates', image_url: 'https://images.unsplash.com/photo-1606189934846-a527add8a77b', election_id: localEnded3.id, vote_count: 91 }
            ]);
        }
        console.log(localEndCreated3 ? '✅ Local Ended Election 3 created' : 'ℹ️  Local Ended Election 3 already exists');

        console.log('\n✅ Database seeded successfully!');
        console.log('\n📝 Login credentials:');
        console.log('   Admin: admin@votesecure.com / admin123');
        console.log('   Voter: john.doe@email.com / voter123');
        console.log('\n📊 Elections created:');
        console.log('   Active: 4 (Federal, State, Local)');
        console.log('   Upcoming: 4 (Federal, State, Local)');
        console.log('   Ended: 5 (Federal, State, Local)');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

seedDatabase();
