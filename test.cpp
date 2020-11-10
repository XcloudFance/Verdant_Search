
#include<bits/stdc++.h>
using namespace std;
int seed=12;int n =10;
int tmp = 0;
void srand(int s) {    seed = s; }

int rand() {    seed = seed * 22695477 + (++tmp);return seed; }

int main(){
for(int i=0;i<n;i++)

{
srand(12);
cout<<rand()%100<<endl;

}
}